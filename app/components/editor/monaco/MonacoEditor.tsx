import { useEffect, useRef, memo } from 'react';
import * as monaco from 'monaco-editor';
import type { EditorDocument } from '../codemirror/CodeMirrorEditor';
import type { Theme } from '~/types/theme';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const logger = createScopedLogger('MonacoEditor');

interface MonacoEditorProps {
  theme: Theme;
  doc?: EditorDocument;
  editable?: boolean;
  onChange?: (content: string) => void;
  onSave?: () => void;
  className?: string;
}

export const MonacoEditor = memo(
  ({ theme, doc, editable = true, onChange, onSave, className }: MonacoEditorProps) => {
    renderLogger.trace('MonacoEditor');

    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const modelRef = useRef<monaco.editor.ITextModel | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      if (!editorRef.current) {
        editorRef.current = monaco.editor.create(containerRef.current, {
          value: doc?.value || '',
          language: getLanguageFromPath(doc?.filePath || ''),
          theme: theme === 'dark' ? 'vs-dark' : 'vs',
          readOnly: !editable,
          automaticLayout: true,
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: '"Fira Code", "Monaco", monospace',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
        });

        modelRef.current = editorRef.current.getModel();

        // Handle save shortcut (Ctrl+S / Cmd+S)
        editorRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          onSave?.();
        });

        // Handle text changes
        editorRef.current.onDidChangeModelContent(() => {
          const content = modelRef.current?.getValue() || '';
          onChange?.(content);
        });
      } else if (doc?.filePath && modelRef.current?.getValue() !== doc.value) {
        // Update content if document changed
        modelRef.current?.setValue(doc.value || '');
        const language = getLanguageFromPath(doc.filePath);
        monaco.editor.setModelLanguage(modelRef.current!, language);
      }
    }, [doc, editable, theme, onChange, onSave]);

    return <div ref={containerRef} className={`w-full h-full ${className || ''}`} />;
  },
);

MonacoEditor.displayName = 'MonacoEditor';

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    md: 'markdown',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    sh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
  };
  return languageMap[ext] || 'plaintext';
}

import { useStore } from '@nanostores/react';
import { memo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ideLayoutStore, setIDEMode, toggleFileTree, toggleTerminal } from '~/lib/stores/ide-layout';
import { EditorPanel } from '~/components/workbench/EditorPanel';
import type { FileMap } from '~/lib/stores/files';
import type { EditorDocument } from '~/components/editor/codemirror/CodeMirrorEditor';
import type { FileHistory } from '~/types/actions';
import { renderLogger } from '~/utils/logger';

interface IDELayoutProps {
  files?: FileMap;
  selectedFile?: string;
  editorDocument?: EditorDocument;
  unsavedFiles?: Set<string>;
  fileHistory?: Record<string, FileHistory>;
  isStreaming?: boolean;
  onFileSelect?: (filePath?: string) => void;
  onEditorChange?: (update: any) => void;
  onFileSave?: () => void;
  onFileReset?: () => void;
}

const SidePanelMode = memo(
  ({
    files,
    selectedFile,
    editorDocument,
    unsavedFiles,
    fileHistory,
    isStreaming,
    onFileSelect,
    onEditorChange,
    onFileSave,
    onFileReset,
  }: IDELayoutProps) => {
    const layout = useStore(ideLayoutStore);

    return (
      <div
        className="flex h-full border-l border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
        style={{ width: `${layout.panelWidth}%` }}
      >
        <EditorPanel
          files={files}
          selectedFile={selectedFile}
          editorDocument={editorDocument}
          unsavedFiles={unsavedFiles}
          fileHistory={fileHistory}
          isStreaming={isStreaming}
          onFileSelect={onFileSelect}
          onEditorChange={onEditorChange}
          onFileSave={onFileSave}
          onFileReset={onFileReset}
        />
      </div>
    );
  },
);

SidePanelMode.displayName = 'SidePanelMode';

const FullScreenMode = memo(
  ({
    files,
    selectedFile,
    editorDocument,
    unsavedFiles,
    fileHistory,
    isStreaming,
    onFileSelect,
    onEditorChange,
    onFileSave,
    onFileReset,
  }: IDELayoutProps) => {
    return (
      <div className="fixed inset-0 z-50 bg-bolt-elements-background-depth-1">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
            <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">IDE</h2>
            <button
              onClick={() => setIDEMode('side-panel')}
              className="px-3 py-1 rounded-lg text-sm text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive"
            >
              Exit Full Screen
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EditorPanel
              files={files}
              selectedFile={selectedFile}
              editorDocument={editorDocument}
              unsavedFiles={unsavedFiles}
              fileHistory={fileHistory}
              isStreaming={isStreaming}
              onFileSelect={onFileSelect}
              onEditorChange={onEditorChange}
              onFileSave={onFileSave}
              onFileReset={onFileReset}
            />
          </div>
        </div>
      </div>
    );
  },
);

FullScreenMode.displayName = 'FullScreenMode';

export const IDELayout = memo(
  ({
    files,
    selectedFile,
    editorDocument,
    unsavedFiles,
    fileHistory,
    isStreaming,
    onFileSelect,
    onEditorChange,
    onFileSave,
    onFileReset,
  }: IDELayoutProps) => {
    renderLogger.trace('IDELayout');

    const layout = useStore(ideLayoutStore);

    if (layout.mode === 'hidden') {
      return null;
    }

    if (layout.mode === 'full-screen') {
      return (
        <FullScreenMode
          files={files}
          selectedFile={selectedFile}
          editorDocument={editorDocument}
          unsavedFiles={unsavedFiles}
          fileHistory={fileHistory}
          isStreaming={isStreaming}
          onFileSelect={onFileSelect}
          onEditorChange={onEditorChange}
          onFileSave={onFileSave}
          onFileReset={onFileReset}
        />
      );
    }

    // Side panel mode
    return (
      <SidePanelMode
        files={files}
        selectedFile={selectedFile}
        editorDocument={editorDocument}
        unsavedFiles={unsavedFiles}
        fileHistory={fileHistory}
        isStreaming={isStreaming}
        onFileSelect={onFileSelect}
        onEditorChange={onEditorChange}
        onFileSave={onFileSave}
        onFileReset={onFileReset}
      />
    );
  },
);

IDELayout.displayName = 'IDELayout';

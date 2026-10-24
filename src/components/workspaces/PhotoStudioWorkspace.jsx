import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import CustomerQueue from '../CustomerQueue';
import ToolsPanel from '../ToolsPanel';
import PhotoEditor from '../PhotoEditor';
import PrintPreview from '../PrintPreview';
import OutputControls from '../OutputControls';

export default function PhotoStudioWorkspace({
  customers,
  activeCustomerId,
  onSelectCustomer,
  onDeleteCustomer,
  onAddCustomer,
  onEnhancePhoto,
  isEnhancingPhoto,
  copies,
  onChangeCopies,
  onAddToPrintPreview,
  onOpenSizeModal,
  onOpenColorModal,
  activeTool,
  setActiveTool,
  activeCustomer,
  onUpdateCustomerPhoto,
  onRemoveBackground,
  isProcessingBg,
  history,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  printQueue,
  onDeleteRow,
  marginX,
  marginY,
  layoutFormat,
  onChangeLayoutFormat,
  onExport,
  onDirectPrint,
  isExporting,
  exportingFormat,
  isPrinting,
  onChangeMarginX,
  onChangeMarginY
}) {
  const photoEditorRef = React.useRef(null);

  // Photo studio local adjustments (Brightness, Contrast, Saturation & Beauty)
  const [adjustments, setAdjustments] = React.useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    beauty: false
  });

  // Name and DOB bottom bounding box state
  const [nameDobBox, setNameDobBox] = React.useState({
    enabled: false,
    name: '',
    dob: ''
  });

  const handleToggleAddText = () => {
    setNameDobBox((prev) => ({
      ...prev,
      enabled: !prev.enabled
    }));
  };

  const handleAddToPrintPreviewWithCrop = () => {
    if (photoEditorRef.current?.getCroppedPhoto) {
      const cropped = photoEditorRef.current.getCroppedPhoto();
      if (cropped) {
        onUpdateCustomerPhoto(cropped);
        onAddToPrintPreview(cropped);
        return;
      }
    }
    onAddToPrintPreview();
  };

  return (
    <main className="flex-1 p-3 grid grid-cols-12 gap-3 overflow-hidden">
      {/* COLUMN 1: LEFT PANEL (Customer Queue & Tools) */}
      <div
        id="left-panel"
        className="col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between overflow-y-auto no-print"
      >
        <div className="flex flex-col gap-2">
          <CustomerQueue
            customers={customers}
            activeCustomerId={activeCustomerId}
            onSelectCustomer={onSelectCustomer}
            onDeleteCustomer={onDeleteCustomer}
            onAddCustomer={onAddCustomer}
          />

          {/* AI HD Clean Button (Left Panel - Under Queue) */}
          <button
            onClick={onEnhancePhoto}
            disabled={isEnhancingPhoto || !activeCustomer?.image}
            className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-xs ${
              isEnhancingPhoto
                ? 'bg-indigo-400 text-white cursor-wait opacity-80'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white active:scale-[0.98]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="AI HD Clean - Deblur & restore facial clarity with strict fidelity"
          >
            {isEnhancingPhoto ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>AI Enhancing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>AI HD Clean</span>
              </>
            )}
          </button>
        </div>

        <ToolsPanel
          copies={copies}
          onChangeCopies={onChangeCopies}
          onAddToPrintPreview={handleAddToPrintPreviewWithCrop}
          onOpenSizeModal={onOpenSizeModal}
          onOpenColorModal={onOpenColorModal}
          onToggleAddText={handleToggleAddText}
          isAddTextActive={nameDobBox.enabled}
          adjustments={adjustments}
          onChangeAdjustments={setAdjustments}
        />
      </div>

      {/* COLUMN 2: CENTER PANEL (Active Editor) */}
      <div id="center-editor" className="col-span-5 flex flex-col h-full overflow-hidden no-print">
        <PhotoEditor
          ref={photoEditorRef}
          activeCustomer={activeCustomer}
          onUpdateCustomerPhoto={onUpdateCustomerPhoto}
          onRemoveBackground={onRemoveBackground}
          isProcessingBg={isProcessingBg}
          history={history}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          adjustments={adjustments}
          onChangeAdjustments={setAdjustments}
          nameDobBox={nameDobBox}
          onChangeNameDobBox={setNameDobBox}
        />
      </div>

      {/* COLUMN 3: RIGHT PANEL (Long Print Preview & Output) */}
      <div className="col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          <PrintPreview
            queueItems={printQueue}
            onDeleteRow={onDeleteRow}
            marginX={marginX}
            marginY={marginY}
          />
        </div>

        <OutputControls
          layoutFormat={layoutFormat}
          onChangeLayoutFormat={onChangeLayoutFormat}
          onExport={onExport}
          onDirectPrint={onDirectPrint}
          isExporting={isExporting}
          exportingFormat={exportingFormat}
          isPrinting={isPrinting}
          hasPhotos={printQueue.length > 0}
          marginX={marginX}
          marginY={marginY}
          onChangeMarginX={onChangeMarginX}
          onChangeMarginY={onChangeMarginY}
        />
      </div>
    </main>
  );
}

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, CheckCircle2, Trash2, Sparkles, Eye } from 'lucide-react';
import { AttachedImage } from '../types/triage';
import { generateSampleCBCReportDataUrl } from '../data/demoCases';

interface LabReportUploadCardProps {
  attachedImage: AttachedImage | null;
  onAttachImage: (image: AttachedImage | null) => void;
}

export const LabReportUploadCard: React.FC<LabReportUploadCardProps> = ({
  attachedImage,
  onAttachImage
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, or WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onAttachImage({
        data: result,
        mimeType: file.type || 'image/jpeg',
        name: file.name,
        previewUrl: result,
        sizeKb: Math.round(file.size / 1024)
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleAttachDemoCBC = () => {
    const dataUrl = generateSampleCBCReportDataUrl();
    onAttachImage({
      data: dataUrl,
      mimeType: 'image/svg+xml',
      name: 'AIIMS_OPD_CBC_Report_A104.png',
      previewUrl: dataUrl,
      sizeKb: 42
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs border border-sky-100">
            03
          </div>
          <div>
            <h3 className="font-heading font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              Lab Report &amp; CBC Attachment
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                Multimodal OCR
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Attach diagnostic photos (CBC, Dengue Serology, Rapid Antigen)
            </p>
          </div>
        </div>

        {/* 1-Click Sample Lab Report Loader */}
        <button
          type="button"
          onClick={handleAttachDemoCBC}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold border border-sky-200/80 transition-colors cursor-pointer flex items-center gap-1.5"
          title="Attach sample AIIMS CBC lab report with 38k platelet thrombocytopenia"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          <span>⚡ Attach Dengue CBC Slip</span>
        </button>
      </div>

      <div className="p-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              processFile(e.target.files[0]);
            }
          }}
        />

        {attachedImage ? (
          /* Confirmation Badge & Thumbnail View */
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <div
                onClick={() => setShowPreviewModal(true)}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-emerald-300 bg-white shrink-0 cursor-pointer shadow-xs group"
                title="Click to view full report"
              >
                <img
                  src={attachedImage.previewUrl}
                  alt={attachedImage.name}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Eye className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-xs text-emerald-900 truncate">
                    {attachedImage.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                  <span className="font-mono">{attachedImage.sizeKb ? `${attachedImage.sizeKb} KB` : 'Attached'}</span>
                  <span>•</span>
                  <span className="font-semibold">Ready for Gemini Multimodal Analysis</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Biomarkers will be extracted and correlated with patient vitals.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => onAttachImage(null)}
                className="px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                title="Remove attached image"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          /* Drag & Drop Zone */
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-sky-500 bg-sky-50/70 scale-[0.99]'
                : 'border-slate-200 hover:border-sky-400 bg-slate-50/50 hover:bg-sky-50/30'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-sky-100/80 text-sky-600 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-slate-700">
                  <span className="text-sky-600 underline">Upload lab report</span> or drag and drop
                </p>
                <p className="text-[11px] text-slate-400">
                  Accepts JPG, PNG, WEBP files up to 10MB
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Preview Modal */}
      {showPreviewModal && attachedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-heading font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                {attachedImage.name}
              </h4>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              <img
                src={attachedImage.previewUrl}
                alt="Attached Report"
                className="max-w-full max-h-[60vh] object-contain rounded shadow-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

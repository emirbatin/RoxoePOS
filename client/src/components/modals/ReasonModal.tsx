import React, { useState } from 'react';

interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  actionText: string;
  type: 'cancel' | 'refund';
}

const ReasonModal: React.FC<ReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionText,
  type
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              İşlem Nedeni
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded-lg"
              placeholder={`${type === 'cancel' ? 'İptal' : 'İade'} sebebini giriniz...`}
              rows={3}
            />
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              onClick={() => {
                if (reason.trim()) {
                  onConfirm(reason);
                  setReason('');
                }
              }}
              disabled={!reason.trim()}
              className={`flex-1 py-2 rounded-lg text-white
                ${type === 'cancel' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-orange-600 hover:bg-orange-700'} 
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {actionText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReasonModal;
interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  loading: boolean;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  count,
  loading,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Confirm Deletion
        </h2>

        <p className="text-gray-300 mb-6">
          Are you sure you want to delete {count} favorite stop
          {count === 1 ? "" : "s"}? This action cannot be undone.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-end sm:space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading
              ? "Deleting..."
              : `Delete ${count} Favorite${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

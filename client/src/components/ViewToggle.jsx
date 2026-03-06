import { LayoutGrid, List } from 'lucide-react';

const ViewToggle = ({ viewMode, setViewMode }) => {
    return (
        <div className="flex items-center gap-1 bg-gray-900/50 p-1 rounded-xl border border-gray-700/50 flex-shrink-0">
            <button
                onClick={() => setViewMode('grid')}
                className={`
                    p-2 rounded-lg transition-all 
                    ${viewMode === 'grid'
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }
                `}
                title="Grid View"
            >
                <LayoutGrid size={18} />
            </button>
            <button
                onClick={() => setViewMode('list')}
                className={`
                    p-2 rounded-lg transition-all 
                    ${viewMode === 'list'
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }
                `}
                title="List View"
            >
                <List size={18} />
            </button>
        </div>
    );
};

export default ViewToggle;


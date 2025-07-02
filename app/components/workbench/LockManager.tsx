import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { workbenchStore } from '~/lib/stores/workbench';
import { getLockedItemsForChat, clearCache } from '~/lib/persistence/lockedFiles';
import { getCurrentChatId } from '~/utils/fileLocks';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';
import { toast } from 'react-toastify';

const logger = createScopedLogger('LockManager');

interface LockedItem {
  chatId: string;
  path: string;
  isFolder: boolean;
}

export const LockManager = () => {
  const files = useStore(workbenchStore.files);
  
  const [lockedItems, setLockedItems] = useState<LockedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('');

  // Load locked items for current chat
  const loadLockedItems = useCallback(() => {
    try {
      const chatId = getCurrentChatId();
      setCurrentChatId(chatId);
      
      const items = getLockedItemsForChat(chatId);
      setLockedItems(items);
      
      logger.info(`Loaded ${items.length} locked items for chat ${chatId}`);
    } catch (error) {
      logger.error('Failed to load locked items:', error);
      toast.error('Failed to load locked items');
    }
  }, []);

  // Load items on mount and when files change
  useEffect(() => {
    loadLockedItems();
  }, [loadLockedItems, files]);

  // Handle item selection for bulk operations
  const toggleItemSelection = useCallback((path: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Select all items
  const selectAll = useCallback(() => {
    setSelectedItems(new Set(lockedItems.map(item => item.path)));
  }, [lockedItems]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Unlock single item
  const unlockItem = useCallback(async (item: LockedItem) => {
    setIsLoading(true);
    try {
      const success = item.isFolder 
        ? workbenchStore.unlockFolder(item.path)
        : workbenchStore.unlockFile(item.path);

      if (success) {
        toast.success(`Unlocked ${item.isFolder ? 'folder' : 'file'}: ${item.path}`);
        loadLockedItems(); // Refresh the list
      } else {
        toast.error(`Failed to unlock ${item.isFolder ? 'folder' : 'file'}: ${item.path}`);
      }
    } catch (error) {
      logger.error('Failed to unlock item:', error);
      toast.error('Failed to unlock item');
    } finally {
      setIsLoading(false);
    }
  }, [loadLockedItems]);

  // Bulk unlock selected items
  const unlockSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;

    setIsLoading(true);
    try {
      const promises = Array.from(selectedItems).map(path => {
        const item = lockedItems.find(i => i.path === path);
        if (!item) return Promise.resolve(false);

        return item.isFolder 
          ? workbenchStore.unlockFolder(item.path)
          : workbenchStore.unlockFile(item.path);
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(Boolean).length;

      if (successCount > 0) {
        toast.success(`Unlocked ${successCount} item${successCount !== 1 ? 's' : ''}`);
        loadLockedItems(); // Refresh the list
        clearSelection();
      } else {
        toast.error('Failed to unlock selected items');
      }
    } catch (error) {
      logger.error('Failed to unlock selected items:', error);
      toast.error('Failed to unlock selected items');
    } finally {
      setIsLoading(false);
    }
  }, [selectedItems, lockedItems, loadLockedItems, clearSelection]);

  // Clear all locks for current chat
  const clearAllLocks = useCallback(async () => {
    if (!window.confirm('Are you sure you want to unlock all files and folders in this project? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const promises = lockedItems.map(item => 
        item.isFolder 
          ? workbenchStore.unlockFolder(item.path)
          : workbenchStore.unlockFile(item.path)
      );

      await Promise.all(promises);
      
      toast.success('All locks cleared');
      loadLockedItems(); // Refresh the list
      clearSelection();
    } catch (error) {
      logger.error('Failed to clear all locks:', error);
      toast.error('Failed to clear all locks');
    } finally {
      setIsLoading(false);
    }
  }, [lockedItems, loadLockedItems, clearSelection]);

  // Refresh locks from storage
  const refreshLocks = useCallback(() => {
    clearCache(); // Clear the cache to force reload from localStorage
    loadLockedItems();
    toast.success('Locks refreshed');
  }, [loadLockedItems]);

  // Get file/folder info
  const getItemInfo = useCallback((item: LockedItem) => {
    const fileOrFolder = files[item.path];
    const exists = !!fileOrFolder;
    const type = item.isFolder ? 'folder' : 'file';
    
    return { exists, type };
  }, [files]);

  // Filter items: separate existing vs non-existing
  const { existingItems, orphanedItems } = lockedItems.reduce(
    (acc, item) => {
      const { exists } = getItemInfo(item);
      if (exists) {
        acc.existingItems.push(item);
      } else {
        acc.orphanedItems.push(item);
      }
      return acc;
    },
    { existingItems: [] as LockedItem[], orphanedItems: [] as LockedItem[] }
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-bolt-elements-borderColor">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Lock Manager</h3>
            <p className="text-xs text-bolt-elements-textSecondary">
              {lockedItems.length} locked item{lockedItems.length !== 1 ? 's' : ''} in current project
            </p>
          </div>
          <button
            onClick={refreshLocks}
            disabled={isLoading}
            className="p-2 hover:bg-bolt-elements-background-depth-2 rounded disabled:opacity-50"
            title="Refresh locks"
          >
            <div className={classNames('i-ph:arrows-clockwise', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Bulk Actions */}
        {lockedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={selectedItems.size === lockedItems.length ? clearSelection : selectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {selectedItems.size === lockedItems.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedItems.size > 0 && (
                <span className="text-xs text-bolt-elements-textSecondary">
                  {selectedItems.size} selected
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={unlockSelected}
                disabled={selectedItems.size === 0 || isLoading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs rounded"
              >
                Unlock Selected
              </button>
              <button
                onClick={clearAllLocks}
                disabled={lockedItems.length === 0 || isLoading}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs rounded"
              >
                Clear All Locks
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lock List */}
      <div className="flex-1 overflow-y-auto">
        {lockedItems.length === 0 ? (
          <div className="p-6 text-center">
            <div className="i-ph:lock-open text-4xl text-bolt-elements-textTertiary mb-2" />
            <p className="text-sm text-bolt-elements-textSecondary mb-1">No locked items</p>
            <p className="text-xs text-bolt-elements-textTertiary">
              Use the context menu in the file tree to lock files and folders
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Existing Items */}
            {existingItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-bolt-elements-textSecondary mb-2 uppercase tracking-wide">
                  Locked Items ({existingItems.length})
                </h4>
                <div className="space-y-1">
                  <AnimatePresence>
                    {existingItems.map((item, index) => (
                      <motion.div
                        key={item.path}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 p-2 bg-bolt-elements-background-depth-2 rounded border border-bolt-elements-borderColor"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.path)}
                          onChange={() => toggleItemSelection(item.path)}
                          className="rounded"
                        />
                        
                        <div className={classNames(
                          'text-sm',
                          item.isFolder ? 'i-ph:folder text-yellow-500' : 'i-ph:file text-blue-500'
                        )} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                            {item.path.split('/').pop()}
                          </div>
                          <div className="text-xs text-bolt-elements-textSecondary truncate">
                            {item.path}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className={classNames(
                            'text-xs px-2 py-0.5 rounded',
                            item.isFolder 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-blue-100 text-blue-800'
                          )}>
                            {item.isFolder ? 'Folder' : 'File'}
                          </span>
                          
                          <button
                            onClick={() => unlockItem(item)}
                            disabled={isLoading}
                            className="p-1 hover:bg-bolt-elements-background-depth-3 rounded disabled:opacity-50"
                            title="Unlock this item"
                          >
                            <div className="i-ph:lock-key-open text-xs" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Orphaned Items */}
            {orphanedItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">
                  Orphaned Locks ({orphanedItems.length})
                </h4>
                <p className="text-xs text-bolt-elements-textTertiary mb-2">
                  These locks reference files or folders that no longer exist
                </p>
                <div className="space-y-1">
                  {orphanedItems.map((item, index) => (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-2 bg-red-50 border border-red-200 rounded"
                    >
                      <div className="i-ph:warning text-red-500" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-red-800 truncate">
                          {item.path.split('/').pop()}
                        </div>
                        <div className="text-xs text-red-600 truncate">
                          {item.path} (missing)
                        </div>
                      </div>

                      <button
                        onClick={() => unlockItem(item)}
                        disabled={isLoading}
                        className="p-1 hover:bg-red-100 rounded disabled:opacity-50 text-red-600"
                        title="Remove this orphaned lock"
                      >
                        <div className="i-ph:trash text-xs" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        <div className="text-xs text-bolt-elements-textTertiary">
          <div>Project ID: {currentChatId}</div>
          <div className="mt-1">
            Locks are scoped to this project and persist across sessions
          </div>
        </div>
      </div>
    </div>
  );
};

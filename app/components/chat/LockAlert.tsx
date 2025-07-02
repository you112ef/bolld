import { AnimatePresence, motion } from 'framer-motion';
import type { ActionAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';

interface Props {
  alert: ActionAlert;
  clearAlert: () => void;
}

export default function LockAlert({ alert, clearAlert }: Props) {
  const { description, content } = alert;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border border-amber-200 bg-amber-50 p-4 mb-2`}
      >
        <div className="flex items-start">
          {/* Lock Icon */}
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className={`i-ph:lock-duotone text-xl text-amber-600`}></div>
          </motion.div>
          {/* Content */}
          <div className="ml-3 flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-medium text-amber-800`}
            >
              File Locked
            </motion.h3>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-2 text-sm text-amber-700`}
            >
              <p>This file or folder is currently locked and cannot be modified.</p>
              <p className="mt-1">To make changes, please unlock it first from the file tree.</p>
              {description && (
                <div className="text-xs text-amber-600 p-2 bg-amber-100 rounded mt-4 mb-4 border-l-4 border-amber-300 font-mono">
                  {description}
                </div>
              )}
              {content && (
                <div className="text-xs text-amber-600 p-2 bg-amber-100 rounded mt-2 border-l-4 border-amber-300 font-mono">
                  Path: {content}
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={classNames('flex gap-2')}>
                <button
                  onClick={clearAlert}
                  className={classNames(
                    `px-3 py-1.5 rounded-md text-sm font-medium`,
                    'bg-amber-600',
                    'hover:bg-amber-700',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500',
                    'text-white',
                    'transition-colors duration-200',
                  )}
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
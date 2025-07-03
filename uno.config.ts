import { globSync } from 'fast-glob';
import fs from 'node:fs/promises';
import { basename } from 'node:path';
import { defineConfig, presetIcons, presetUno, transformerDirectives } from 'unocss';

const iconPaths = globSync('./icons/*.svg');

const collectionName = 'bolt';

const customIconCollection = iconPaths.reduce(
  (acc, iconPath) => {
    const [iconName] = basename(iconPath).split('.');

    acc[collectionName] ??= {};
    acc[collectionName][iconName] = async () => fs.readFile(iconPath, 'utf8');

    return acc;
  },
  {} as Record<string, Record<string, () => Promise<string>>>,
);

const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  accent: {
    50: '#F8F5FF',
    100: '#F0EBFF',
    200: '#E1D6FF',
    300: '#CEBEFF',
    400: '#B69EFF',
    500: '#9C7DFF',
    600: '#8A5FFF',
    700: '#7645E8',
    800: '#6234BB',
    900: '#502D93',
    950: '#2D1959',
  },
  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },
  orange: {
    50: '#FFFAEB',
    100: '#FEEFC7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
    800: '#93370D',
    900: '#792E0D',
  },
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },
};

const COLOR_PRIMITIVES = {
  ...BASE_COLORS,
  alpha: {
    white: generateAlphaPalette(BASE_COLORS.white),
    gray: generateAlphaPalette(BASE_COLORS.gray[900]),
    red: generateAlphaPalette(BASE_COLORS.red[500]),
    accent: generateAlphaPalette(BASE_COLORS.accent[500]),
  },
};

export default defineConfig({
  safelist: [
    ...Object.keys(customIconCollection[collectionName] || {}).map((x) => `i-bolt:${x}`),
    // Performance: Pre-generate common utility classes
    'transition-theme',
    'bolt-ease-cubic-bezier',
    'max-w-chat',
    'glass-card',
    'elevated-card',
    'focus-ring',
  ],
  shortcuts: {
    // Enhanced easing and transitions
    'bolt-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
    'bolt-ease-spring': 'ease-[cubic-bezier(0.175,0.885,0.32,1.275)]',
    'transition-theme': 'transition-[background-color,border-color,color] duration-150 bolt-ease-cubic-bezier',
    'transition-smooth': 'transition-all duration-200 bolt-ease-cubic-bezier',
    'transition-spring': 'transition-all duration-300 bolt-ease-spring',
    
    // Enhanced keyboard and accessibility
    kdb: 'bg-bolt-elements-code-background text-bolt-elements-code-text py-1 px-1.5 rounded-md font-mono text-sm',
    'focus-ring': 'focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive focus:ring-offset-2 focus:ring-offset-bolt-elements-bg-depth-1',
    'focus-ring-inset': 'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-bolt-elements-borderColorActive',
    
    // Layout and sizing
    'max-w-chat': 'max-w-[var(--chat-max-width)]',
    'container-responsive': 'mx-auto px-4 sm:px-6 lg:px-8',
    'full-bleed': 'w-screen relative left-1/2 right-1/2 -mx-[50vw]',
    
    // Enhanced card system
    'glass-card': 'backdrop-blur-md bg-bolt-elements-bg-depth-1/80 border border-bolt-elements-borderColor rounded-lg',
    'elevated-card': 'bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200',
    'interactive-card': 'elevated-card hover:border-bolt-elements-borderColorActive cursor-pointer transition-smooth',
    
    // Button variants
    'btn-base': 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-smooth focus-ring disabled:opacity-50 disabled:pointer-events-none',
    'btn-primary': 'btn-base bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover',
    'btn-secondary': 'btn-base bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover',
    'btn-danger': 'btn-base bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover',
    'btn-ghost': 'btn-base hover:bg-bolt-elements-bg-depth-2 text-bolt-elements-textPrimary',
    'btn-sm': 'h-8 px-3 text-xs',
    'btn-md': 'h-10 px-4',
    'btn-lg': 'h-12 px-6',
    
    // Input variants
    'input-base': 'block w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 px-3 py-2 text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:border-bolt-elements-borderColorActive focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive transition-smooth',
    'input-error': 'border-bolt-elements-icon-error focus:border-bolt-elements-icon-error focus:ring-bolt-elements-icon-error',
    
    // Status indicators
    'status-success': 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    'status-warning': 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    'status-error': 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    'status-info': 'bg-accent-100 text-accent-800 dark:bg-accent-900/20 dark:text-accent-400',
    
    // Scrollbar styling
    'scrollbar-styled': 'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bolt-elements-borderColor hover:scrollbar-thumb-bolt-elements-borderColorActive',
    
    // Loading states
    'loading-skeleton': 'animate-pulse bg-bolt-elements-bg-depth-2 rounded',
    'loading-shimmer': 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
  },
  rules: [
    /**
     * This shorthand doesn't exist in Tailwind and we overwrite it to avoid
     * any conflicts with minified CSS classes.
     */
    ['b', {}],
    
    // Custom animation keyframes
    ['animate-shimmer', { animation: 'shimmer 2s infinite' }],
    
    // Enhanced spacing system
    ['space-section', { 'margin-top': '4rem', 'margin-bottom': '4rem' }],
    ['space-component', { 'margin-top': '2rem', 'margin-bottom': '2rem' }],
    
    // Enhanced text utilities
    ['text-balance', { 'text-wrap': 'balance' }],
    ['text-pretty', { 'text-wrap': 'pretty' }],
  ],
  theme: {
    colors: {
      ...COLOR_PRIMITIVES,
      bolt: {
        elements: {
          borderColor: 'var(--bolt-elements-borderColor)',
          borderColorActive: 'var(--bolt-elements-borderColorActive)',
          background: {
            depth: {
              1: 'var(--bolt-elements-bg-depth-1)',
              2: 'var(--bolt-elements-bg-depth-2)',
              3: 'var(--bolt-elements-bg-depth-3)',
              4: 'var(--bolt-elements-bg-depth-4)',
            },
          },
          textPrimary: 'var(--bolt-elements-textPrimary)',
          textSecondary: 'var(--bolt-elements-textSecondary)',
          textTertiary: 'var(--bolt-elements-textTertiary)',
          code: {
            background: 'var(--bolt-elements-code-background)',
            text: 'var(--bolt-elements-code-text)',
          },
          button: {
            primary: {
              background: 'var(--bolt-elements-button-primary-background)',
              backgroundHover: 'var(--bolt-elements-button-primary-backgroundHover)',
              text: 'var(--bolt-elements-button-primary-text)',
            },
            secondary: {
              background: 'var(--bolt-elements-button-secondary-background)',
              backgroundHover: 'var(--bolt-elements-button-secondary-backgroundHover)',
              text: 'var(--bolt-elements-button-secondary-text)',
            },
            danger: {
              background: 'var(--bolt-elements-button-danger-background)',
              backgroundHover: 'var(--bolt-elements-button-danger-backgroundHover)',
              text: 'var(--bolt-elements-button-danger-text)',
            },
          },
          item: {
            contentDefault: 'var(--bolt-elements-item-contentDefault)',
            contentActive: 'var(--bolt-elements-item-contentActive)',
            contentAccent: 'var(--bolt-elements-item-contentAccent)',
            contentDanger: 'var(--bolt-elements-item-contentDanger)',
            backgroundDefault: 'var(--bolt-elements-item-backgroundDefault)',
            backgroundActive: 'var(--bolt-elements-item-backgroundActive)',
            backgroundAccent: 'var(--bolt-elements-item-backgroundAccent)',
            backgroundDanger: 'var(--bolt-elements-item-backgroundDanger)',
          },
          actions: {
            background: 'var(--bolt-elements-actions-background)',
            code: {
              background: 'var(--bolt-elements-actions-code-background)',
            },
          },
          artifacts: {
            background: 'var(--bolt-elements-artifacts-background)',
            backgroundHover: 'var(--bolt-elements-artifacts-backgroundHover)',
            borderColor: 'var(--bolt-elements-artifacts-borderColor)',
            inlineCode: {
              background: 'var(--bolt-elements-artifacts-inlineCode-background)',
              text: 'var(--bolt-elements-artifacts-inlineCode-text)',
            },
          },
          messages: {
            background: 'var(--bolt-elements-messages-background)',
            linkColor: 'var(--bolt-elements-messages-linkColor)',
            code: {
              background: 'var(--bolt-elements-messages-code-background)',
            },
            inlineCode: {
              background: 'var(--bolt-elements-messages-inlineCode-background)',
              text: 'var(--bolt-elements-messages-inlineCode-text)',
            },
          },
          icon: {
            success: 'var(--bolt-elements-icon-success)',
            error: 'var(--bolt-elements-icon-error)',
            primary: 'var(--bolt-elements-icon-primary)',
            secondary: 'var(--bolt-elements-icon-secondary)',
            tertiary: 'var(--bolt-elements-icon-tertiary)',
          },
          preview: {
            addressBar: {
              background: 'var(--bolt-elements-preview-addressBar-background)',
              backgroundHover: 'var(--bolt-elements-preview-addressBar-backgroundHover)',
              backgroundActive: 'var(--bolt-elements-preview-addressBar-backgroundActive)',
              text: 'var(--bolt-elements-preview-addressBar-text)',
              textActive: 'var(--bolt-elements-preview-addressBar-textActive)',
            },
          },
          terminals: {
            background: 'var(--bolt-elements-terminals-background)',
            buttonBackground: 'var(--bolt-elements-terminals-buttonBackground)',
          },
          dividerColor: 'var(--bolt-elements-dividerColor)',
          loader: {
            background: 'var(--bolt-elements-loader-background)',
            progress: 'var(--bolt-elements-loader-progress)',
          },
          prompt: {
            background: 'var(--bolt-elements-prompt-background)',
          },
          sidebar: {
            dropdownShadow: 'var(--bolt-elements-sidebar-dropdownShadow)',
            buttonBackgroundDefault: 'var(--bolt-elements-sidebar-buttonBackgroundDefault)',
            buttonBackgroundHover: 'var(--bolt-elements-sidebar-buttonBackgroundHover)',
            buttonText: 'var(--bolt-elements-sidebar-buttonText)',
          },
          cta: {
            background: 'var(--bolt-elements-cta-background)',
            text: 'var(--bolt-elements-cta-text)',
          },
        },
      },
    },
    animation: {
      'shimmer': 'shimmer 2s infinite',
      'slide-up': 'slide-up 0.3s ease-out',
      'slide-down': 'slide-down 0.3s ease-out',
      'fade-in': 'fade-in 0.2s ease-out',
      'scale-in': 'scale-in 0.2s ease-out',
    },
    keyframes: {
      shimmer: {
        '100%': {
          transform: 'translateX(100%)',
        },
      },
      'slide-up': {
        '0%': {
          transform: 'translateY(10px)',
          opacity: '0',
        },
        '100%': {
          transform: 'translateY(0)',
          opacity: '1',
        },
      },
      'slide-down': {
        '0%': {
          transform: 'translateY(-10px)',
          opacity: '0',
        },
        '100%': {
          transform: 'translateY(0)',
          opacity: '1',
        },
      },
      'fade-in': {
        '0%': {
          opacity: '0',
        },
        '100%': {
          opacity: '1',
        },
      },
      'scale-in': {
        '0%': {
          transform: 'scale(0.95)',
          opacity: '0',
        },
        '100%': {
          transform: 'scale(1)',
          opacity: '1',
        },
      },
    },
  },
  transformers: [transformerDirectives()],
  presets: [
    presetUno({
      dark: {
        light: '[data-theme="light"]',
        dark: '[data-theme="dark"]',
      },
    }),
    presetIcons({
      warn: true,
      collections: {
        ...customIconCollection,
      },
      unit: 'em',
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
});

/**
 * Generates an alpha palette for a given hex color.
 *
 * @param hex - The hex color code (without alpha) to generate the palette from.
 * @returns An object where keys are opacity percentages and values are hex colors with alpha.
 *
 * Example:
 *
 * ```
 * {
 *   '1': '#FFFFFF03',
 *   '2': '#FFFFFF05',
 *   '3': '#FFFFFF08',
 * }
 * ```
 */
function generateAlphaPalette(hex: string) {
  return [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reduce(
    (acc, opacity) => {
      const alpha = Math.round((opacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

      acc[opacity] = `${hex}${alpha}`;

      return acc;
    },
    {} as Record<number, string>,
  );
}

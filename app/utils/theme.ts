import { MantineThemeOverride, rem } from '@mantine/core';

export const analyticsTheme: MantineThemeOverride = {
  // Color palette inspired by the dashboard
  colors: {
    // Primary brand colors (pinks/reds from the UI)
    brand: [
      '#fff0f3', // lightest
      '#ffe0e8',
      '#ffb3cc',
      '#ff8fb3',
      '#ff6b9a',
      '#ff4781', // main brand color (similar to the pink accents)
      '#e63d73',
      '#cc3366',
      '#b32959',
      '#99204d'  // darkest
    ],
    
    // Secondary colors (blues from charts and accents)
    secondary: [
      '#f0f7ff',
      '#e1f0ff',
      '#c2e0ff',
      '#a3d1ff',
      '#84c2ff',
      '#4299e1', // main secondary (blue from charts)
      '#3182ce',
      '#2c5aa0',
      '#2a4a7c',
      '#1e3a5f'
    ],
    
    // Success/green colors
    success: [
      '#f0fff4',
      '#c6f6d5',
      '#9ae6b4',
      '#68d391',
      '#48bb78',
      '#38a169', // main success color
      '#2f855a',
      '#276749',
      '#22543d',
      '#1a202c'
    ],
    
    // Gray scale (from the subtle backgrounds and text)
    gray: [
      '#fafafa', // very light background
      '#f5f5f5', // card backgrounds
      '#e8e8e8', // borders
      '#d1d1d1',
      '#b0b0b0',
      '#898989', // secondary text
      '#6b6b6b',
      '#4a4a4a', // primary text
      '#2d2d2d',
      '#1a1a1a'  // darkest text
    ]
  },

  // Primary color
  primaryColor: 'brand',

  // Default radius for rounded corners (the UI has very rounded elements)
  defaultRadius: 'md',
  
  // Radius values
  radius: {
    xs: rem(4),
    sm: rem(8),
    md: rem(12), // default
    lg: rem(16),
    xl: rem(20),
  },

  // Spacing scale
  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(20),
    xl: rem(24),
  },

  // Font sizes
  fontSizes: {
    xs: rem(10),
    sm: rem(12),
    md: rem(14), // default
    lg: rem(16),
    xl: rem(18),
  },

  // Line heights
  lineHeights: {
    xs: '1.2',
    sm: '1.35',
    md: '1.45', // default
    lg: '1.55',
    xl: '1.65',
  },

  // Font family (clean, modern sans-serif)
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, monospace',

  // Headings configuration
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: rem(28), lineHeight: '1.3' },
      h2: { fontSize: rem(24), lineHeight: '1.35' },
      h3: { fontSize: rem(20), lineHeight: '1.4' },
      h4: { fontSize: rem(18), lineHeight: '1.45' },
      h5: { fontSize: rem(16), lineHeight: '1.5' },
      h6: { fontSize: rem(14), lineHeight: '1.5' },
    },
  },

  // Shadows (soft, subtle shadows like in the interface)
  shadows: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },

  // Component-specific overrides
  components: {
    // Paper/Card styling
    Paper: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        p: 'md',
      },
      styles: (theme) => ({
        root: {
          backgroundColor: theme.white,
          border: `1px solid ${theme.colors.gray[2]}`,
        },
      }),
    },

    // Button styling (matching the clean button style)
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: (theme) => ({
        root: {
          fontWeight: 500,
          border: 'none',
          transition: 'all 150ms ease',
          
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        
        // Variant styles
        filled: {
          background: `linear-gradient(135deg, ${theme.colors.brand[6]} 0%, ${theme.colors.brand[7]} 100%)`,
          
          '&:hover': {
            background: `linear-gradient(135deg, ${theme.colors.brand[7]} 0%, ${theme.colors.brand[8]} 100%)`,
          },
        },
        
        outline: {
          borderColor: theme.colors.gray[3],
          color: theme.colors.gray[7],
          
          '&:hover': {
            backgroundColor: theme.colors.gray[0],
            borderColor: theme.colors.brand[4],
          },
        },
      }),
    },

    // Input styling
    Input: {
      defaultProps: {
        radius: 'md',
      },
      styles: (theme) => ({
        input: {
          border: `1px solid ${theme.colors.gray[3]}`,
          backgroundColor: theme.white,
          fontSize: theme.fontSizes.sm,
          
          '&:focus': {
            borderColor: theme.colors.brand[4],
            boxShadow: `0 0 0 1px ${theme.colors.brand[4]}`,
          },
          
          '&::placeholder': {
            color: theme.colors.gray[5],
          },
        },
      }),
    },

    // Select styling
    Select: {
      defaultProps: {
        radius: 'md',
      },
      styles: (theme) => ({
        input: {
          border: `1px solid ${theme.colors.gray[3]}`,
          backgroundColor: theme.white,
          
          '&:focus': {
            borderColor: theme.colors.brand[4],
            boxShadow: `0 0 0 1px ${theme.colors.brand[4]}`,
          },
        },
      }),
    },

    // Badge styling (for metrics and status indicators)
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
      styles: (theme) => ({
        root: {
          fontWeight: 500,
          fontSize: rem(11),
          height: rem(20),
          paddingLeft: rem(8),
          paddingRight: rem(8),
        },
      }),
    },

    // Card styling for dashboard widgets
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        padding: 'lg',
      },
      styles: (theme) => ({
        root: {
          backgroundColor: theme.white,
          border: `1px solid ${theme.colors.gray[2]}`,
          transition: 'all 150ms ease',
          
          '&:hover': {
            shadow: theme.shadows.md,
            transform: 'translateY(-2px)',
          },
        },
      }),
    },

    // Table styling
    Table: {
      styles: (theme) => ({
        root: {
          backgroundColor: theme.white,
        },
        
        thead: {
          backgroundColor: theme.colors.gray[0],
        },
        
        th: {
          fontWeight: 600,
          fontSize: theme.fontSizes.sm,
          color: theme.colors.gray[7],
          padding: rem(12),
          borderBottom: `1px solid ${theme.colors.gray[2]}`,
        },
        
        td: {
          padding: rem(12),
          borderBottom: `1px solid ${theme.colors.gray[1]}`,
          fontSize: theme.fontSizes.sm,
        },
        
        tr: {
          '&:hover': {
            backgroundColor: theme.colors.gray[0],
          },
        },
      }),
    },

    // Tabs styling
    Tabs: {
      styles: (theme) => ({
        tab: {
          fontWeight: 500,
          color: theme.colors.gray[6],
          
          '&[data-active]': {
            color: theme.colors.brand[6],
            borderBottomColor: theme.colors.brand[6],
          },
          
          '&:hover': {
            color: theme.colors.brand[5],
          },
        },
      }),
    },

    // Modal styling
    Modal: {
      styles: (theme) => ({
        content: {
          borderRadius: theme.radius.lg,
        },
        
        header: {
          paddingBottom: rem(16),
          marginBottom: rem(16),
          borderBottom: `1px solid ${theme.colors.gray[2]}`,
        },
      }),
    },

    // Notification styling
    Notification: {
      styles: (theme) => ({
        root: {
          borderRadius: theme.radius.md,
          padding: rem(16),
        },
        
        title: {
          fontWeight: 600,
        },
      }),
    },
  },

  // Global styles
  globalStyles: (theme) => ({
    body: {
      backgroundColor: theme.colors.gray[0],
      color: theme.colors.gray[8],
    },
    
    // Scrollbar styling
    '*::-webkit-scrollbar': {
      width: rem(6),
      height: rem(6),
    },
    
    '*::-webkit-scrollbar-track': {
      backgroundColor: theme.colors.gray[1],
    },
    
    '*::-webkit-scrollbar-thumb': {
      backgroundColor: theme.colors.gray[4],
      borderRadius: rem(3),
      
      '&:hover': {
        backgroundColor: theme.colors.gray[5],
      },
    },
  }),

  // Other theme properties
  other: {
    // Custom properties for specific use cases
    cardHoverTransform: 'translateY(-2px)',
    gradientFrom: '#ff4781',
    gradientTo: '#e63d73',
    
    // Chart colors (for data visualization)
    chartColors: [
      '#ff4781', // primary pink
      '#4299e1', // blue
      '#38a169', // green
      '#ed8936', // orange
      '#9f7aea', // purple
      '#38b2ac', // teal
      '#f56565', // red
      '#4fd1c7', // cyan
    ],
  },
};

export const theme = analyticsTheme;
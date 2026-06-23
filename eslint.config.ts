import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,

  // Enforce `{ a, b }` brace spacing. Placed after skipFormatting so it stays
  // active; matches Prettier's bracketSpacing: true.
  {
    name: 'app/brace-spacing',
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      'object-curly-spacing': ['error', 'always'],
    },
  },

  // Allow underscore-prefixed bindings to be intentionally unused.
  {
    name: 'app/unused-vars-underscore',
    files: ['**/*.{ts,mts,tsx,vue}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
)

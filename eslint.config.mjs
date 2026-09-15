// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['warn', { endOfLine: 'auto' }],
      // ECWC-527: throw new Error ใน catch กลบ HttpException ให้เป็น 500 หมด ใช้ rethrowAsHttp แทน
      // ยังเป็น warn เพราะโค้ดเดิมมีอีก ~100 จุด ค่อยไล่แก้แล้วยกเป็น error
      'no-restricted-syntax': [
        'warn',
        {
          selector: "CatchClause ThrowStatement > NewExpression[callee.name='Error']",
          message:
            "อย่า throw new Error ใน catch — ใช้ rethrowAsHttp(error, this.logger, 'context') จาก src/common/http-error.util",
        },
      ],
    },
  },
);
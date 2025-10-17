import eslint from '@janone/eslint-config';

export default eslint({
    react: true,
    nextjs: true,
    typescript: true,
    rules: {
        'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'react-refresh/only-export-components': 'off',
        'style/jsx-one-expression-per-line': 'off',
        'style/jsx-curly-newline': 'off',
        'style/multiline-ternary': 'off',
        'node/prefer-global/process': 'off',
        'node/prefer-global/buffer': 'off'
    }
});

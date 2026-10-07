import { eslintCompatPlugin } from '@oxlint/plugins';
import { noReduceAccumulatorCopyRule } from './rules/no-reduce-accumulator-copy.ts';

// Selected after paired evaluation; the upstream all-rules entry point is not used.
export default eslintCompatPlugin({
  meta: { name: 'anti-slop' },
  rules: { 'no-reduce-accumulator-copy': noReduceAccumulatorCopyRule },
});

declare module 'react-katex' {
  import { FC } from 'react';

  interface KatexProps {
    math: string;
    block?: boolean;
    errorColor?: string;
    renderError?: (error: Error) => React.ReactNode;
  }

  export const InlineMath: FC<KatexProps>;
  export const BlockMath: FC<KatexProps>;
}

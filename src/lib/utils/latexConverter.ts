/**
 * LaTeX to Plain Text Converter
 *
 * AI가 반환하는 LaTeX 수식을 읽기 쉬운 텍스트로 변환합니다.
 * 공식 칩(chip)에서 사용됩니다.
 */

/**
 * LaTeX 명령어 포함 여부 확인
 */
export function containsLatex(text: string): boolean {
  if (!text) return false;

  // 일반적인 LaTeX 명령어 패턴
  const latexPatterns = [
    /\\frac\{/,
    /\\cdot/,
    /\\times/,
    /\\sqrt\{/,
    /\\text\{/,
    /\\alpha/,
    /\\beta/,
    /\\gamma/,
    /\\theta/,
    /\\eta/,
    /\\omega/,
    /\\Omega/,
    /\\pi/,
    /\\sum/,
    /\\int/,
    /\\infty/,
    /\^{?\d+}?/, // 지수
    /_{?\d+}?/,  // 아래첨자
    /\\\\/,      // 줄바꿈
    /\\[a-zA-Z]+/, // 일반 LaTeX 명령어
  ];

  return latexPatterns.some(pattern => pattern.test(text));
}

/**
 * LaTeX를 읽기 쉬운 텍스트로 변환
 */
export function latexToPlainText(latex: string): string {
  if (!latex) return '';

  let result = latex;

  // 1. \frac{분자}{분모} → 분자 / 분모
  result = result.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) / ($2)');
  // 중첩된 frac 처리 (최대 3단계)
  for (let i = 0; i < 3; i++) {
    result = result.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) / ($2)');
  }

  // 2. 곱셈 기호
  result = result.replace(/\\cdot/g, '×');
  result = result.replace(/\\times/g, '×');

  // 3. 제곱근
  result = result.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // 4. 텍스트
  result = result.replace(/\\text\{([^{}]+)\}/g, '$1');
  result = result.replace(/\\textbf\{([^{}]+)\}/g, '$1');
  result = result.replace(/\\mathrm\{([^{}]+)\}/g, '$1');

  // 5. 그리스 문자
  const greekLetters: Record<string, string> = {
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\delta': 'δ',
    '\\epsilon': 'ε',
    '\\zeta': 'ζ',
    '\\eta': 'η',
    '\\theta': 'θ',
    '\\iota': 'ι',
    '\\kappa': 'κ',
    '\\lambda': 'λ',
    '\\mu': 'μ',
    '\\nu': 'ν',
    '\\xi': 'ξ',
    '\\pi': 'π',
    '\\rho': 'ρ',
    '\\sigma': 'σ',
    '\\tau': 'τ',
    '\\upsilon': 'υ',
    '\\phi': 'φ',
    '\\chi': 'χ',
    '\\psi': 'ψ',
    '\\omega': 'ω',
    '\\Gamma': 'Γ',
    '\\Delta': 'Δ',
    '\\Theta': 'Θ',
    '\\Lambda': 'Λ',
    '\\Xi': 'Ξ',
    '\\Pi': 'Π',
    '\\Sigma': 'Σ',
    '\\Phi': 'Φ',
    '\\Psi': 'Ψ',
    '\\Omega': 'Ω',
  };

  for (const [latex, symbol] of Object.entries(greekLetters)) {
    result = result.replace(new RegExp(latex.replace(/\\/g, '\\\\'), 'g'), symbol);
  }

  // 6. 수학 기호
  result = result.replace(/\\pm/g, '±');
  result = result.replace(/\\mp/g, '∓');
  result = result.replace(/\\leq/g, '≤');
  result = result.replace(/\\geq/g, '≥');
  result = result.replace(/\\neq/g, '≠');
  result = result.replace(/\\approx/g, '≈');
  result = result.replace(/\\infty/g, '∞');
  result = result.replace(/\\sum/g, 'Σ');
  result = result.replace(/\\int/g, '∫');
  result = result.replace(/\\partial/g, '∂');
  result = result.replace(/\\nabla/g, '∇');
  result = result.replace(/\\rightarrow/g, '→');
  result = result.replace(/\\leftarrow/g, '←');
  result = result.replace(/\\Rightarrow/g, '⇒');
  result = result.replace(/\\Leftarrow/g, '⇐');

  // 7. 지수와 아래첨자
  // ^{2} → ² 등 (일반적인 숫자만)
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ',
  };

  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋',
  };

  // ^{숫자} → 유니코드 위첨자
  result = result.replace(/\^{([0-9+-n]+)}/g, (_, chars) => {
    return chars.split('').map((c: string) => superscripts[c] || c).join('');
  });
  // ^숫자 (중괄호 없는 단일 문자)
  result = result.replace(/\^([0-9])/g, (_, c) => superscripts[c] || `^${c}`);

  // _{숫자} → 유니코드 아래첨자
  result = result.replace(/_{([0-9+-]+)}/g, (_, chars) => {
    return chars.split('').map((c: string) => subscripts[c] || c).join('');
  });
  // _숫자 (중괄호 없는 단일 문자)
  result = result.replace(/_([0-9])/g, (_, c) => subscripts[c] || `_${c}`);

  // 8. 남은 중괄호 제거
  result = result.replace(/\{/g, '');
  result = result.replace(/\}/g, '');

  // 9. 이스케이프 문자 제거
  result = result.replace(/\\\[/g, '');
  result = result.replace(/\\\]/g, '');
  result = result.replace(/\\\(/g, '');
  result = result.replace(/\\\)/g, '');
  result = result.replace(/\\ /g, ' ');

  // 10. 남은 backslash 명령어 제거 (예: \quad, \left, \right 등)
  result = result.replace(/\\[a-zA-Z]+/g, ' ');

  // 11. 연속 공백 정리
  result = result.replace(/\s+/g, ' ');

  // 12. 불필요한 괄호 정리
  result = result.replace(/\(\s*\)/g, '');
  result = result.replace(/\(\s+/g, '(');
  result = result.replace(/\s+\)/g, ')');

  return result.trim();
}

/**
 * 공식 문자열을 정리하여 표시용으로 변환
 * - LaTeX가 포함되어 있으면 plain text로 변환
 * - 이미 plain text이면 그대로 반환
 */
export function formatFormulaForDisplay(formula: string): string {
  if (!formula) return '';

  // LaTeX가 포함되어 있으면 변환
  if (containsLatex(formula)) {
    return latexToPlainText(formula);
  }

  return formula;
}

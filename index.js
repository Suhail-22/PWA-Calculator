// --- Library Imports ---
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- Services ---
function parseExpression(expr) {
    if (!expr) return 0;
    expr = expr.replace(/(?<=^|[-+*/(])-/g, 'N');
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
        const char = expr[i];
        if (/\d/.test(char) || (char === '.')) {
            let numStr = '';
            while (i < expr.length && /[\d.]/.test(expr[i])) {
                numStr += expr[i];
                i++;
            }
            if ((numStr.match(/\./g) || []).length > 1) throw new Error('نقطة عشرية غير صالحة');
            tokens.push(parseFloat(numStr));
        } else if (char === 'N') {
            tokens.push('N');
            i++;
        } else if (['(', ')', '+', '-', '*', '/'].includes(char)) {
            if (char === '(' && i + 1 < expr.length && expr[i+1] === ')') {
              throw new Error('تعبير غير صالح');
            }
            tokens.push(char);
            i++;
        } else {
            throw new Error('رمز غير معروف');
        }
    }
    if (tokens.length === 0) return 0;
    const output = [];
    const operators = [];
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, 'N': 3 };
    const isOperator = (t) => ['+', '-', '*', '/', 'N'].includes(t);
    for (const token of tokens) {
        if (typeof token === 'number') {
            output.push(token);
        } else if (token === '(') {
            operators.push(token);
        } else if (token === ')') {
            while (operators.length > 0 && operators[operators.length - 1] !== '(') {
                output.push(operators.pop());
            }
            if (operators.length === 0) throw new Error('أقواس غير متوازنة');
            operators.pop();
        } else if (isOperator(token)) {
            while (operators.length > 0 && operators[operators.length - 1] !== '(' && precedence[operators[operators.length - 1]] >= precedence[token]) {
                output.push(operators.pop());
            }
            operators.push(token);
        }
    }
    while (operators.length > 0) {
        const op = operators.pop();
        if (op === '(') throw new Error('أقواس غير متوازنة');
        output.push(op);
    }
    const stack = [];
    for (const token of output) {
        if (typeof token === 'number') {
            stack.push(token);
        } else if (isOperator(token)) {
            if (token === 'N') {
                if (stack.length < 1) throw new Error('تعبير غير صالح');
                stack.push(-stack.pop());
                continue;
            }
            if (stack.length < 2) throw new Error('تعبير غير صالح');
            const b = stack.pop();
            const a = stack.pop();
            let result;
            switch (token) {
                case '+': result = a + b; break;
                case '-': result = a - b; break;
                case '*': result = a * b; break;
                case '/':
                    if (b === 0) throw new Error('القسمة على صفر');
                    result = a / b;
                    break;
                default: throw new Error('عامل غير معروف');
            }
            stack.push(result);
        }
    }
    if (stack.length !== 1) throw new Error('تعبير غير صالح');
    return stack[0];
}

function getLocalFix(expression) {
    let fixedExpr = expression;
    fixedExpr = fixedExpr.replace(/([+\-×÷])\1+/g, '$1');
    if (fixedExpr !== expression) {
        return { fix: fixedExpr, message: 'تمت إزالة عامل التشغيل المكرر.' };
    }
    if (fixedExpr.includes('()')) {
        fixedExpr = fixedExpr.replace(/([+\-×÷]?)\(\)/g, '');
        return { fix: fixedExpr || '0', message: 'تمت إزالة الأقواس الفارغة.' };
    }
    if (/[+\-×÷]$/.test(fixedExpr.trim())) {
        fixedExpr = fixedExpr.trim().slice(0, -1);
        return { fix: fixedExpr, message: 'تمت إزالة عامل التشغيل في النهاية.' };
    }
    const openParenCount = (fixedExpr.match(/\(/g) || []).length;
    const closeParenCount = (fixedExpr.match(/\)/g) || []).length;
    if (openParenCount > closeParenCount) {
        fixedExpr += ')'.repeat(openParenCount - closeParenCount);
        return { fix: fixedExpr, message: 'تمت إضافة قوس إغلاق مفقود.' };
    }
    return { message: 'التعبير يحتوي على خطأ.', fix: '' };
}

function findErrorDetails(expression, message) {
    if (message.includes('أقواس غير متوازنة')) {
        let balance = 0;
        for (let i = 0; i < expression.length; i++) {
            if (expression[i] === '(') balance++;
            if (expression[i] === ')') balance--;
        }
        if (balance > 0) {
            let openParenIndex = expression.lastIndexOf('(');
             let tempBalance = 0;
             for (let i = openParenIndex; i < expression.length; i++) {
                 if (expression[i] === '(') tempBalance++;
                 if (expression[i] === ')') tempBalance--;
             }
             if (tempBalance > 0) {
                  return {
                    pre: expression.substring(0, openParenIndex),
                    highlight: expression[openParenIndex],
                    post: expression.substring(openParenIndex + 1)
                  };
             }
        }
    }
    if (message.includes('القسمة على صفر')) {
        const match = expression.match(/÷0(?!\.)/);
        if (match && typeof match.index === 'number') {
            return {
                pre: expression.substring(0, match.index),
                highlight: '÷0',
                post: expression.substring(match.index + 2)
            };
        }
    }
    if (message.includes('تعبير غير صالح')) {
        const match = expression.match(/\(\)/);
        if (match && typeof match.index === 'number') {
            return {
                pre: expression.substring(0, match.index),
                highlight: '()',
                post: expression.substring(match.index + 2)
            };
        }
    }
    return null;
}

// --- Hooks ---
const defaultButtonLayout = [
  { id: 'ac', label: 'AC', action: 'clear', type: 'function' },
  { id: 'backspace', label: '←', action: 'backspace', type: 'function' },
  { id: 'ans', label: 'Ans', action: 'appendAnswer', type: 'function' },
  { id: 'percent', label: '%', value: '%', type: 'function' },
  { id: 'divide', label: '÷', value: '÷', type: 'operator' },
  { id: '7', label: '7', value: '7', type: 'number' },
  { id: '8', label: '8', value: '8', type: 'number' },
  { id: '9', label: '9', value: '9', type: 'number' },
  { id: 'sign', label: '±', action: 'toggleSign', type: 'function' },
  { id: 'multiply', label: '×', value: '×', type: 'operator' },
  { id: '4', label: '4', value: '4', type: 'number' },
  { id: '5', label: '5', value: '5', type: 'number' },
  { id: '6', label: '6', value: '6', type: 'number' },
  { id: 'paren', label: '( )', action: 'parenthesis', type: 'operator' },
  { id: 'subtract', label: '-', value: '-', type: 'operator' },
  { id: '1', label: '1', value: '1', type: 'number' },
  { id: '2', label: '2', value: '2', type: 'number' },
  { id: '3', label: '3', value: '3', type: 'number' },
  { id: 'decimal', label: '.', value: '.', type: 'number' },
  { id: 'add', label: '+', value: '+', type: 'operator' },
  { id: '0', label: '0', value: '0', type: 'number' },
  { id: '00', label: '00', value: '00', type: 'number' },
  { id: '000', label: '000', value: '000', type: 'number' },
  { id: 'equals', label: '=', action: 'calculate', type: 'equals', span: 2 },
];

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });
  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
};

const useCalculator = ({ showNotification }) => {
  const [input, setInput] = useState('0');
  const [history, setHistory] = useLocalStorage('calcHistory_v2', []);
  const [lastAnswer, setLastAnswer] = useLocalStorage('calcLastAnswer', '0');
  const [vibrationEnabled, setVibrationEnabled] = useLocalStorage('calcVibration', true);
  const [taxSettings, setTaxSettings] = useLocalStorage('calcTaxSettings', { isEnabled: false, mode: 'add-15', rate: 15, showTaxPerNumber: false });
  const [maxHistory, setMaxHistory] = useLocalStorage('calcMaxHistory', 50);
  const [buttonLayout, setButtonLayout] = useLocalStorage('calcButtonLayout_v8', defaultButtonLayout);
  const [calculationExecuted, setCalculationExecuted] = useState(false);
  const [error, setError] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const entryCount = useMemo(() => {
      if (calculationExecuted) return 1;
      if (input === '0' || !input) return 0;
      const numbers = input.match(/\d+(\.\d+)?/g);
      return numbers ? numbers.length : 0;
  }, [input, calculationExecuted]);
  const vibrate = (duration = 30) => {
    if (vibrationEnabled && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };
  const clearAll = useCallback(() => {
    vibrate(50);
    setInput('0');
    setCalculationExecuted(false);
    setError(null);
    setAiSuggestion(null);
  }, [vibrationEnabled]);
  const backspace = useCallback(() => {
    vibrate(30);
    setError(null);
    setAiSuggestion(null);
    setInput(prev => {
      const newStr = prev.slice(0, -1);
      return newStr === '' || newStr === '0' ? '0' : newStr;
    });
    setCalculationExecuted(false);
  }, [vibrationEnabled]);
  const append = useCallback((value) => {
    vibrate(20);
    setError(null);
    setAiSuggestion(null);
    if (calculationExecuted) {
      const isOperator = ['+', '-', '×', '÷'].includes(value);
      setInput(isOperator ? input + value : value);
      setCalculationExecuted(false);
      return;
    }
    setInput(prev => {
      if (prev === '0' && !['.', '(', ')'].includes(value)) return value;
      const lastChar = prev.slice(-1);
      if (lastChar === ')' && !['+', '-', '×', '÷', '%', ')'].includes(value)) {
          return prev + '×' + value;
      }
      if (['+', '×', '÷'].includes(value) && ['+', '×', '÷', '-'].includes(prev.slice(-1))) {
        return prev.slice(0, -1) + value;
      }
      return prev + value;
    });
  }, [calculationExecuted, input, vibrationEnabled]);
   const toggleSign = useCallback(() => {
    vibrate(30);
    const isSimpleNumber = /^-?\d+(\.\d+)?$/.test(input);
    if (calculationExecuted || isSimpleNumber) {
        setInput(prev => {
            if (prev === '0') return '0';
            const new_input = prev.startsWith('-') ? prev.slice(1) : '-' + prev;
            setCalculationExecuted(false);
            return new_input;
        });
    }
  }, [vibrationEnabled, calculationExecuted, input]);
  const handleParenthesis = useCallback(() => {
    vibrate(20);
    setError(null);
    setAiSuggestion(null);
    if (calculationExecuted) {
        setInput('(');
        setCalculationExecuted(false);
        return;
    }
    setInput(prev => {
        const openParenCount = (prev.match(/\(/g) || []).length;
        const closeParenCount = (prev.match(/\)/g) || []).length;
        const lastChar = prev.slice(-1);
        if (openParenCount > closeParenCount && !['(', '+', '-', '×', '÷'].includes(lastChar)) {
            return prev + ')';
        } else {
            if (prev === '0') return '(';
            if (!isNaN(parseInt(lastChar, 10)) || lastChar === ')') {
                return prev + '×(';
            }
            return prev + '(';
        }
    });
  }, [calculationExecuted, vibrationEnabled]);
   const appendAnswer = useCallback(() => {
    vibrate(20);
    setError(null);
    setAiSuggestion(null);
    if (calculationExecuted) {
        setInput(lastAnswer);
        setCalculationExecuted(false);
        return;
    }
    setInput(prev => {
        if (prev === '0') return lastAnswer;
        const lastChar = prev.slice(-1);
         if (!isNaN(parseInt(lastChar, 10)) || lastChar === ')') {
            return prev + '×' + lastAnswer;
        }
        return prev + lastAnswer;
    });
  }, [lastAnswer, calculationExecuted, vibrationEnabled]);
  const calculate = useCallback(() => {
    vibrate(70);
    setError(null);
    setAiSuggestion(null);
    const expression = input;
    if (expression === '0') return;
    try {
      const safeExpr = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100').replace(/(?<=^|\()(\+)/g, '');
      let result = parseExpression(safeExpr);
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error('تعبير غير صالح رياضيًا.');
      }
      const resultStr = result.toLocaleString('en-US', {maximumFractionDigits: 10, useGrouping: false});
      setLastAnswer(resultStr);
      const now = new Date();
      let taxResultValue = null;
      let effectiveTaxRate = taxSettings.rate;
      if (taxSettings.isEnabled) {
          if (taxSettings.mode === 'divide-93') {
              taxResultValue = result / 0.93;
          } else {
              if (taxSettings.mode === 'add-7') effectiveTaxRate = 7;
              if (taxSettings.mode === 'add-15') effectiveTaxRate = 15;
              taxResultValue = result * (1 + effectiveTaxRate / 100);
          }
      }
      const taxResult = taxResultValue ? taxResultValue.toLocaleString('en-US', {maximumFractionDigits: 10, useGrouping: false}) : null;
      const newItem = {
        expression: expression,
        result: resultStr,
        taxResult: taxResult,
        taxMode: taxSettings.isEnabled ? taxSettings.mode : null,
        taxRate: taxSettings.isEnabled ? effectiveTaxRate : null,
        date: now.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      };
      setHistory([newItem, ...history].slice(0, maxHistory));
      setInput(resultStr);
      setCalculationExecuted(true);
    } catch (e) {
      const errorMessage = e.message || 'خطأ غير معروف';
      setError({ message: errorMessage, details: findErrorDetails(expression, errorMessage) });
      setCalculationExecuted(false);
      const suggestion = getLocalFix(expression);
      if (suggestion && suggestion.fix) {
        setAiSuggestion(suggestion);
      }
    }
  }, [input, taxSettings, history, setHistory, vibrationEnabled, maxHistory, setLastAnswer]);
  const applyAiFix = useCallback(() => {
    if (aiSuggestion?.fix) {
        setInput(aiSuggestion.fix);
        setError(null);
        setAiSuggestion(null);
    }
  }, [aiSuggestion]);
  const clearHistory = useCallback(() => {
    if (history.length > 0 && window.confirm("هل أنت متأكد أنك تريد مسح السجل بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) {
        vibrate(50);
        setHistory([]);
    }
  }, [setHistory, vibrationEnabled, history.length]);
  const loadFromHistory = useCallback((expression) => {
    setInput(expression);
    setCalculationExecuted(false);
    setError(null);
    setAiSuggestion(null);
  }, []);
  const updateInput = useCallback((value) => {
    setError(null);
    setAiSuggestion(null);
    if (calculationExecuted) {
        setCalculationExecuted(false);
    }
    setInput(value === '' ? '0' : value);
  }, [calculationExecuted]);
  return {
    input, history, error, aiSuggestion, isCalculationExecuted: calculationExecuted, entryCount,
    settings: {
      vibrationEnabled, setVibrationEnabled,
      taxSettings, setTaxSettings, maxHistory, setMaxHistory, buttonLayout
    },
    actions: {
      append, clearAll, backspace, calculate, toggleSign, handleParenthesis, appendAnswer, applyAiFix, clearHistory, loadFromHistory, updateInput
    }
  };
};

// --- Components ---
const Button = ({ children, onClick, className = '', style = {} }) => {
  return (
    React.createElement('button', {
      onClick: onClick,
      style: style,
      className: `border border-[var(--button-border-color)] py-4 text-2xl rounded-2xl cursor-pointer transition-all duration-100 text-center select-none shadow-[var(--button-number-shadow)] active:transform active:scale-[0.95] active:shadow-[var(--button-number-active-shadow)] active:brightness-95 ${className}`,
    }, React.createElement('span', { style: { textShadow: 'var(--button-text-shadow, none)' } }, children))
  );
};

const Overlay = ({ show, onClick }) => {
  return (
    React.createElement('div', {
      onClick: onClick,
      className: `fixed inset-0 bg-black/70 z-40 transition-opacity duration-300 ${show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`
    })
  );
};

const Notification = ({ message, show }) => {
  return (
    React.createElement('div', {
      className: `fixed left-1/2 -translate-x-1/2 bottom-5 bg-green-600/95 text-white py-3 px-6 rounded-full z-[100] shadow-lg text-base text-center transition-opacity duration-300 ${show ? 'opacity-100 animate-bounce-in-up' : 'opacity-0 pointer-events-none'}`
    }, message)
  );
};

const Header = ({ taxSettings, onToggleSettings, onShare, onToggleHistory, historyCount, entryCountDisplay }) => {
  const { isEnabled, rate, mode } = taxSettings;
  const getTaxRateLabel = () => {
    if (!isEnabled) return '---';
    if (mode === 'add-7') return '7%';
    if (mode === 'add-15') return '15%';
    if (mode === 'divide-93') return 'مقسوم على 0.93';
    return `${rate}% مخصص`;
  };
  return (
    React.createElement('div', { className: "flex justify-between items-center p-2.5 rounded-2xl mb-4 bg-[var(--bg-header)] border border-[var(--border-primary)] backdrop-blur-sm" },
      React.createElement(Button, { onClick: onShare, className: "!p-1.5 !text-lg !min-w-[45px] !rounded-xl bg-[var(--bg-inset)] !text-[var(--text-secondary)]" }, "📤"),
      React.createElement('div', { className: "flex items-center gap-2" },
        React.createElement('div', { className: `text-sm py-1 px-2.5 rounded-xl bg-[var(--bg-inset)] text-[var(--text-secondary)] whitespace-nowrap transition-opacity duration-300 ${isEnabled ? 'opacity-100' : 'opacity-60'}` },
          "الضريبة: ", React.createElement('span', { className: "font-bold text-[var(--text-primary)]" }, getTaxRateLabel())
        ),
         React.createElement('div', { className: "text-sm py-1 px-2.5 rounded-xl bg-[var(--bg-inset)] text-[var(--text-secondary)] whitespace-nowrap" },
          "الإدخالات: ", React.createElement('span', { className: "font-bold text-[var(--text-primary)]" }, entryCountDisplay)
        )
      ),
      React.createElement('div', { className: "flex items-center gap-2" },
        React.createElement('div', { className: "relative" },
          React.createElement(Button, { onClick: onToggleHistory, className: "!p-1.5 !text-lg !min-w-[45px] !rounded-xl bg-[var(--bg-inset)] text-[var(--text-secondary)]" }, "📜"),
          historyCount > 0 && React.createElement('span', { className: "absolute -top-1 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center pointer-events-none" }, historyCount > 99 ? '99+' : historyCount)
        ),
        React.createElement(Button, { onClick: onToggleSettings, className: "!p-1.5 !text-lg !min-w-[45px] !rounded-xl bg-[var(--bg-inset)] text-[var(--text-primary)]" }, "⚙️")
      )
    )
  );
};

const calculateTaxForNumber = (numStr, settings) => {
  const num = parseFloat(numStr);
  if (isNaN(num)) return '';
  let taxValue = 0;
  if (settings.mode === 'divide-93') {
    taxValue = (num / 0.93) - num;
  } else {
    let effectiveRate = settings.rate;
    if (settings.mode === 'add-7') effectiveRate = 7;
    if (settings.mode === 'add-15') effectiveRate = 15;
    taxValue = num * (effectiveRate / 100);
  }
  return taxValue.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false });
};

const renderPreviewWithTax = (text, settings) => {
  if (!settings.isEnabled || !settings.showTaxPerNumber || !text) return text;
  const parts = text.split(/([0-9.]+)/g);
  return (
    React.createElement(React.Fragment, null,
      parts.map((part, index) => {
        if (/[0-9.]+/.test(part) && !isNaN(parseFloat(part))) {
          const tax = calculateTaxForNumber(part, settings);
          return (
            React.createElement('span', { key: index, className: "relative inline-block mx-px pt-5" },
              React.createElement('span', { className: "absolute top-0 left-1/2 -translate-x-1/2 text-xs text-yellow-400 bg-gray-900/60 px-1.5 py-0.5 rounded whitespace-nowrap" },
                tax
              ),
              part
            )
          );
        }
        return React.createElement('span', { key: index }, part);
      })
    )
  );
};

const Display = ({ input, taxSettings, error, aiSuggestion, onApplyAiFix, isCalculationExecuted, onUpdateInput }) => {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef(null);
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [isEditing]);
  useEffect(() => {
    if (isEditing && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input, isEditing]);
  let liveResult = '0';
  let taxAmount = '';
  let totalWithTax = '';
  let preview = isCalculationExecuted ? '' : input;
  if (error) {
    liveResult = '...';
  } else if (isCalculationExecuted) {
    liveResult = input;
    preview = '';
  } else {
    try {
      const safeExpr = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100').replace(/(?<=^|\()(\+)/g, '');
      const result = parseExpression(safeExpr);
      if (!isNaN(result) && isFinite(result)) {
        liveResult = result.toLocaleString('en-US', {maximumFractionDigits: 10, useGrouping: false});
      }
    } catch (e) {
      liveResult = '...';
    }
  }
  if (taxSettings.isEnabled && !isNaN(parseFloat(liveResult))) {
    const numResult = parseFloat(liveResult);
    let taxValue = 0;
    let totalValue = 0;
    if (taxSettings.mode === 'divide-93') {
        totalValue = numResult / 0.93;
        taxValue = totalValue - numResult;
    } else {
        let effectiveRate = taxSettings.rate;
        if (taxSettings.mode === 'add-7') effectiveRate = 7;
        if (taxSettings.mode === 'add-15') effectiveRate = 15;
        taxValue = numResult * (effectiveRate / 100);
        totalValue = numResult + taxValue;
    }
    taxAmount = `ضريبة: ${taxValue.toLocaleString('en-US', {maximumFractionDigits: 2, useGrouping: false})}`;
    totalWithTax = `الإجمالي: ${totalValue.toLocaleString('en-US', {maximumFractionDigits: 2, useGrouping: false})}`;
  }
  const displayBorderClass = error || aiSuggestion ? 'bg-gradient-to-r from-red-600 via-orange-500 to-red-600 shadow-[0_0_20px_rgba(255,61,0,0.7)]' : '';
  const renderHighlightedExpression = () => {
    let content;
    if (error?.details) {
        const { pre, highlight, post } = error.details;
        content = React.createElement(React.Fragment, null,
            pre,
            React.createElement('span', { className: 'text-red-500 bg-red-500/20 rounded-md px-1 error-highlight' }, highlight),
            post
        );
    } else if (taxSettings.showTaxPerNumber) {
        content = renderPreviewWithTax(preview, taxSettings);
    } else {
        content = preview || ' ';
    }
    if (aiSuggestion?.fix) {
        return React.createElement('span', { className: 'ai-suggestion-highlight' }, content);
    }
    return content;
  };
  return (
    React.createElement('div', { className: "relative p-4 bg-[var(--bg-display)] rounded-[25px] mb-4 border border-[var(--border-primary)] shadow-[inset_0_4px_10px_rgba(0,0,0,0.08)] min-h-[220px] flex flex-col justify-between" },
      React.createElement('div', { className: `absolute inset-0 -z-10 rounded-[22px] transition-all duration-300 ${displayBorderClass}` }),
      React.createElement('div', { className: "px-1.5 flex flex-col justify-end flex-grow" },
        React.createElement('div', { className: "text-xl text-[var(--text-secondary)] mb-1 text-left direction-ltr break-all min-h-[30px]", onClick: () => !isCalculationExecuted && setIsEditing(true) },
            isEditing ? (
                 React.createElement('textarea', {
                    ref: textareaRef,
                    value: preview,
                    onChange: (e) => onUpdateInput(e.target.value),
                    onBlur: () => setIsEditing(false),
                    className: "w-full bg-transparent border-none outline-none resize-none text-xl opacity-70 text-left direction-ltr p-0 m-0 leading-normal text-[var(--text-display)]",
                    rows: 1
                })
            ) : (
                renderHighlightedExpression()
            )
        ),
        React.createElement('div', { key: liveResult, className: "text-6xl mt-auto font-bold text-center direction-ltr overflow-x-auto whitespace-nowrap text-[var(--text-display)] scrollbar-hide leading-tight", style: { textShadow: 'var(--display-text-shadow, none)' } },
          React.createElement('span', { className: "inline-block animate-pop-in" }, liveResult)
        )
      ),
      React.createElement('div', { className: "relative h-12" },
        React.createElement('div', { key: taxAmount + totalWithTax, className: "absolute bottom-8 left-0 right-0 text-sm text-cyan-400 flex justify-between px-2" },
          React.createElement('span', { className: "inline-block animate-pop-in" }, taxAmount),
          React.createElement('span', { className: "inline-block animate-pop-in" }, totalWithTax)
        ),
        (aiSuggestion || error) && (
          React.createElement('div', { className: "absolute bottom-0 left-0 right-0 text-center text-sm text-[#ff3d00] bg-[rgba(255,61,0,0.15)] p-2 rounded-xl border border-[rgba(255,61,0,0.7)] z-10 flex justify-between items-center" },
              React.createElement('span', { className: "flex-grow text-right px-2" },
                aiSuggestion?.message || error?.message
              ),
              aiSuggestion?.fix && (
                  React.createElement('button', { onClick: onApplyAiFix, className: "bg-none border-none text-sky-500 dark:text-[#4fc3f7] font-bold cursor-pointer mr-1 whitespace-nowrap" }, "[✨ تصحيح آلي]")
              )
          )
        )
      )
    )
  );
};

const ButtonGrid = ({ onAppend, onClear, onBackspace, onCalculate, onToggleSign, onParenthesis, onToggleHistory, onAppendAnswer, layout }) => {
  return (
    React.createElement('div', { className: "grid grid-cols-5 gap-3" },
      layout.map((btn) => {
        const handleClick = () => {
          if (btn.action === 'clear') onClear();
          else if (btn.action === 'backspace') onBackspace();
          else if (btn.action === 'calculate') onCalculate();
          else if (btn.action === 'toggleSign') onToggleSign();
          else if (btn.action === 'parenthesis') onParenthesis();
          else if (btn.action === 'toggleHistory') onToggleHistory();
          else if (btn.action === 'appendAnswer') onAppendAnswer();
          else if (btn.value) onAppend(btn.value);
        };
        let style = {};
        let className = '';
        if (btn.type === 'number') {
            style.background = 'var(--button-number-bg)';
            style.color = 'var(--button-text-color-custom, var(--text-primary))';
        }
        if (btn.type === 'operator' || btn.type === 'function') {
            style.background = 'var(--button-function-bg)';
            style.color = 'var(--button-text-color-custom, var(--accent-color))';
        }
        if (btn.type === 'history') {
            style.background = 'var(--button-function-bg)';
            style.color = 'var(--text-secondary)';
            className += ' !text-base';
        }
        if (btn.type === 'equals') {
            style.background = 'var(--accent-equals-bg)';
            style.color = 'var(--accent-equals-text)';
            className += ' animate-pulse-special';
        }
        if (btn.span === 2) className += ' col-span-2';
        return (
          React.createElement(Button, {
            key: btn.id,
            onClick: handleClick,
            className: className,
            style: style,
          },
            btn.label
          )
        );
      })
    )
  );
};

const Calculator = ({ calculator, onToggleSettings, onToggleHistory, onShare, entryCount }) => {
  const { taxSettings } = calculator.settings;
  const { input, error, aiSuggestion, actions } = calculator;
  const handleShare = async () => {
    const expression = calculator.isCalculationExecuted ? calculator.history[0]?.expression : input;
    let resultText = '...';
    if (calculator.isCalculationExecuted) {
        resultText = input;
    } else {
        try {
            const safeExpr = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100');
            const liveResult = parseExpression(safeExpr);
            if (!isNaN(liveResult) && isFinite(liveResult)) {
                resultText = liveResult.toLocaleString('en-US', {maximumFractionDigits: 10, useGrouping: false});
            }
        } catch (e) { /* keep '...' if live parsing fails */ }
    }
    const textToShare = `العملية الحسابية:
${expression}
النتيجة:
${resultText}`;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'نتيجة من الآلة الحاسبة الذكية',
                text: textToShare,
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                navigator.clipboard.writeText(textToShare);
                onShare('فشلت المشاركة، تم النسخ إلى الحافظة!');
            }
        }
    } else {
        navigator.clipboard.writeText(textToShare);
        onShare('تم النسخ إلى الحافظة!');
    }
  };
  return (
    React.createElement('div', { className: "relative max-w-md w-full z-10 animate-container-in" },
      React.createElement('div', {
          className: "bg-[var(--bg-calculator)] rounded-[28px] p-4 w-[420px] relative backdrop-blur-xl z-10 border border-[var(--border-primary)]",
          style: { boxShadow: 'var(--calculator-shadow, none)' }
        },
        React.createElement(Header, {
          taxSettings: taxSettings,
          onToggleSettings: onToggleSettings,
          onShare: handleShare,
          onToggleHistory: onToggleHistory,
          historyCount: calculator.history.length,
          entryCountDisplay: entryCount
        }),
        React.createElement(Display, {
          input: input,
          taxSettings: taxSettings,
          error: error,
          aiSuggestion: aiSuggestion,
          onApplyAiFix: actions.applyAiFix,
          isCalculationExecuted: calculator.isCalculationExecuted,
          onUpdateInput: actions.updateInput,
        }),
        React.createElement(ButtonGrid, {
          onAppend: actions.append,
          onClear: actions.clearAll,
          onBackspace: actions.backspace,
          onCalculate: actions.calculate,
          onToggleSign: actions.toggleSign,
          onParenthesis: actions.handleParenthesis,
          onToggleHistory: onToggleHistory,
          onAppendAnswer: actions.appendAnswer,
          layout: calculator.settings.buttonLayout,
        })
      )
    )
  );
};

const SettingsPanel = ({ isOpen, onClose, settings, theme, onThemeChange, fontFamily, setFontFamily, fontScale, setFontScale, buttonTextColor, setButtonTextColor, onOpenSupport, onShowAbout, onCheckForUpdates }) => {
  const { vibrationEnabled, setVibrationEnabled, taxSettings, setTaxSettings, maxHistory, setMaxHistory } = settings;
  const handleTaxChange = (e) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = e.target.checked;
    setTaxSettings(prev => ({
        ...prev,
        [name]: isCheckbox ? checked : value
    }));
  };
  const handleTaxRateChange = (e) => {
     const value = e.target.value;
     setTaxSettings(prev => ({...prev, rate: parseFloat(value) || 0}));
  };
  return (
    React.createElement('div', { className: `fixed top-0 bottom-0 right-0 w-[320px] max-w-[85vw] bg-[var(--bg-panel)] text-[var(--text-primary)] z-50 p-5 shadow-2xl overflow-y-auto border-l-2 border-[var(--border-primary)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] transform ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}` },
      React.createElement('div', { className: "flex justify-between items-center mb-6" },
        React.createElement('h3', { className: "text-[var(--accent-color)] text-2xl font-bold" }, "⚙️ الإعدادات"),
        React.createElement('button', { onClick: onClose, className: "text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" }, "✕")
      ),
      React.createElement('div', { className: "mb-6" },
        React.createElement('h4', { className: "text-lg font-semibold text-[var(--text-secondary)] mb-3" }, "🎨 المظهر"),
        React.createElement('div', { className: "grid grid-cols-3 gap-2 p-1 rounded-xl bg-[var(--bg-inset)]" },
          React.createElement('button', { onClick: () => onThemeChange('light'), className: `py-2 rounded-lg text-sm transition-all ${theme === 'light' ? 'bg-[var(--accent-color)] text-[var(--accent-color-contrast)] font-bold' : ''}` }, "فاتح"),
          React.createElement('button', { onClick: () => onThemeChange('dark'), className: `py-2 rounded-lg text-sm transition-all ${theme === 'dark' ? 'bg-[var(--accent-color)] text-[var(--accent-color-contrast)] font-bold' : ''}` }, "داكن"),
          React.createElement('button', { onClick: () => onThemeChange('system'), className: `py-2 rounded-lg text-sm transition-all ${theme === 'system' ? 'bg-[var(--accent-color)] text-[var(--accent-color-contrast)] font-bold' : ''}` }, "حسب النظام")
        )
      ),
      React.createElement('div', { className: "mb-6" },
        React.createElement('h4', { className: "text-lg font-semibold text-[var(--text-secondary)] mb-3" }, "✒️ الخطوط"),
        React.createElement('div', { className: "mb-4" },
            React.createElement('label', { htmlFor: "font-family-select", className: "block text-[var(--text-secondary)] mb-2 text-sm" }, "نوع الخط:"),
            React.createElement('select', { id: "font-family-select", value: fontFamily, onChange: e => setFontFamily(e.target.value), className: "w-full p-2.5 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-inset)] text-[var(--text-primary)] text-base" },
                React.createElement('option', { value: 'Tajawal' }, 'Tajawal (افتراضي)'),
                React.createElement('option', { value: 'Cairo' }, 'Cairo'),
                React.createElement('option', { value: 'Almarai' }, 'Almarai')
            )
        ),
        React.createElement('div', { className: "mb-4" },
            React.createElement('label', { htmlFor: "font-size-slider", className: "block text-[var(--text-secondary)] mb-2 text-sm" }, `حجم الخط: (${Math.round(fontScale * 100)}%)`),
            React.createElement('input', { id: "font-size-slider", type: 'range', min: '0.85', max: '1.15', step: '0.05', value: fontScale, onChange: e => setFontScale(parseFloat(e.target.value)), className: 'w-full h-2 bg-[var(--bg-inset)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-color)]' })
        ),
        React.createElement('div', { className: "mt-4" },
            React.createElement('label', { htmlFor: "button-text-color-picker", className: "flex justify-between items-center text-[var(--text-secondary)] text-sm mb-2" },
                React.createElement('span', null, "لون خط الأزرار:"),
                React.createElement('button', { onClick: () => setButtonTextColor(null), className: `text-xs text-[var(--accent-color)] hover:underline ${!buttonTextColor ? 'opacity-50 cursor-not-allowed' : ''}`, disabled: !buttonTextColor }, "إعادة تعيين")
            ),
            React.createElement('div', { className: "relative" },
                React.createElement('input', { id: "button-text-color-picker", type: "color", value: buttonTextColor || '#ffffff', onChange: e => setButtonTextColor(e.target.value), className: "w-full h-10 p-1 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-inset)] cursor-pointer" })
            )
        )
      ),
      React.createElement('hr', { className: "border-[var(--border-secondary)] my-4" }),
      React.createElement('div', { className: "mb-6" },
        React.createElement('h4', { className: "text-lg font-semibold text-[var(--text-secondary)] mb-3" }, "💰 إعدادات الضريبة"),
        React.createElement('label', { className: "flex items-center mb-4 text-[var(--text-secondary)] font-bold" },
          React.createElement('input', { type: "checkbox", name: "isEnabled", checked: taxSettings.isEnabled, onChange: handleTaxChange, className: "ml-3 w-5 h-5 accent-[var(--accent-color)]" }),
          "تفعيل حساب الضريبة"
        ),
        React.createElement('label', { className: `flex items-center mb-4 text-[var(--text-secondary)] transition-opacity ${taxSettings.isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}` },
            React.createElement('input', { type: "checkbox", name: "showTaxPerNumber", checked: taxSettings.showTaxPerNumber, onChange: handleTaxChange, disabled: !taxSettings.isEnabled, className: "ml-3 w-5 h-5 accent-[var(--accent-color)]" }),
            "عرض الضريبة فوق كل رقم"
        ),
        React.createElement('select', { name: "mode", value: taxSettings.mode, onChange: handleTaxChange, className: "w-full p-2.5 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-inset)] text-[var(--text-primary)] mb-4 text-base" },
          React.createElement('option', { value: "add-7" }, "إضافة 7%"),
          React.createElement('option', { value: "add-15" }, "إضافة 15%"),
          React.createElement('option', { value: "divide-93" }, "القسمة على 0.93"),
          React.createElement('option', { value: "custom" }, "مخصص")
        ),
        taxSettings.mode === 'custom' && (
          React.createElement('input', { type: "number", value: taxSettings.rate, onChange: handleTaxRateChange, placeholder: "أدخل نسبة مخصصة %", min: "0", step: "0.01", className: "w-full p-2.5 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-inset)] text-[var(--text-primary)] mb-4 text-base" })
        )
      ),
       React.createElement('div', { className: "mb-6" },
        React.createElement('h4', { className: "text-lg font-semibold text-[var(--text-secondary)] mb-3" }, "⚙️ إعدادات عامة"),
        React.createElement('label', { className: "flex items-center justify-between text-[var(--text-secondary)] mb-4" },
          React.createElement('span', null, "الحد الأقصى للسجل:"),
          React.createElement('input', { type: "number", value: maxHistory, onChange: (e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0 && val <= 100) {
                setMaxHistory(val);
              }
            }, min: "1", max: "100", className: "w-24 p-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-inset)] text-[var(--text-primary)] text-center"
          })
        ),
        React.createElement('label', { className: "flex items-center justify-between text-[var(--text-secondary)]" },
          React.createElement('span', null, "تفعيل الاهتزاز عند الضغط"),
          React.createElement('input', { type: "checkbox", checked: vibrationEnabled, onChange: (e) => setVibrationEnabled(e.target.checked), className: "w-5 h-5 accent-[var(--accent-color)]" })
        )
      ),
      React.createElement('hr', { className: "border-[var(--border-secondary)] my-4" }),
      React.createElement('div', { className: "flex flex-col gap-3" },
        React.createElement('button', { onClick: onCheckForUpdates, className: "w-full py-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-inset)] text-[var(--text-primary)] font-bold text-base hover:brightness-95" }, "✨ التحقق من التحديثات"),
        React.createElement('button', { onClick: onShowAbout, className: "w-full py-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-inset)] text-[var(--text-primary)] font-bold text-base hover:brightness-95" }, "ℹ️ حول الآلة الحاسبة"),
        React.createElement('button', { onClick: onOpenSupport, className: "w-full bg-gradient-to-br from-green-600/50 to-green-700/60 text-white border border-green-400/80 rounded-xl py-3 font-bold text-lg shadow-[0_5px_12px_rgba(0,0,0,0.35),0_0_18px_rgba(100,220,100,0.35)] mt-3 hover:from-green-600/60" }, "💬 تواصل مع الدعم")
      )
    )
  );
};

const HistoryPanel = ({ isOpen, onClose, history, onClearHistory, onHistoryItemClick, onExportHistory, onExportCsvHistory }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const handleExport = (exportFunc) => {
    exportFunc(startDate, endDate);
  };
  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };
  return (
    React.createElement('div', { className: `fixed top-0 bottom-0 left-0 w-[320px] max-w-[85vw] bg-[var(--bg-panel)] text-[var(--text-primary)] z-50 p-5 shadow-2xl overflow-y-auto border-r-2 border-[var(--border-primary)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] transform ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}` },
      React.createElement('div', { className: "flex justify-between items-center mb-4" },
        React.createElement('h3', { className: "text-[var(--accent-color)] text-2xl font-bold" }, `📜 السجل (${history.length})`),
        React.createElement('button', { onClick: onClose, className: "text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" }, "✕")
      ),
      React.createElement('div', { className: "p-3 bg-[var(--bg-inset)] rounded-xl mb-4" },
        React.createElement('h4', { className: "text-sm text-[var(--text-secondary)] font-semibold mb-2" }, "تصفية التصدير حسب التاريخ"),
        React.createElement('div', { className: "flex gap-2 mb-2" },
            React.createElement('div', { className: "flex-1" },
                React.createElement('label', { htmlFor: "start-date", className: "text-xs opacity-70" }, "من:"),
                React.createElement('input', { id: "start-date", type: "date", value: startDate, onChange: e => setStartDate(e.target.value), className: "w-full p-1.5 rounded-md border border-[var(--border-secondary)] bg-[var(--bg-inset-light)] text-sm" })
            ),
            React.createElement('div', { className: "flex-1" },
                React.createElement('label', { htmlFor: "end-date", className: "text-xs opacity-70" }, "إلى:"),
                React.createElement('input', { id: "end-date", type: "date", value: endDate, onChange: e => setEndDate(e.target.value), className: "w-full p-1.5 rounded-md border border-[var(--border-secondary)] bg-[var(--bg-inset-light)] text-sm" })
            )
        ),
        React.createElement('button', { onClick: clearDates, className: "w-full text-center text-xs text-[var(--accent-color)] hover:underline" }, "مسح التحديد")
      ),
      React.createElement('div', { className: "text-center mb-4 flex justify-center gap-2" },
        React.createElement('button', { onClick: onClearHistory, className: "py-1 px-3 text-sm rounded-lg bg-[var(--bg-inset)] text-[var(--accent-color)] hover:brightness-95 transition-colors" }, "مسح السجل"),
        React.createElement('button', { onClick: () => handleExport(onExportHistory), className: "py-1 px-3 text-sm rounded-lg bg-[var(--bg-inset)] text-sky-400 hover:brightness-95 transition-colors" }, "تصدير TXT"),
        React.createElement('button', { onClick: () => handleExport(onExportCsvHistory), className: "py-1 px-3 text-sm rounded-lg bg-[var(--bg-inset)] text-green-400 hover:brightness-95 transition-colors" }, "تصدير CSV")
      ),
      React.createElement('div', { className: "flex flex-col gap-2" },
        history.length === 0 ? (
          React.createElement('p', { className: "text-center text-[var(--text-secondary)] text-base mt-8" }, "السجل فارغ.")
        ) : (
          history.map((item, index) => (
            React.createElement('div', { key: index, onClick: () => onHistoryItemClick(item), className: "p-4 bg-[var(--bg-inset-light)] rounded-xl cursor-pointer transition-all duration-200 hover:bg-[var(--bg-inset)] hover:scale-[1.02]" },
              React.createElement('div', { className: "text-base opacity-80 direction-ltr text-left break-all text-[var(--text-secondary)]" }, item.expression, " ="),
              React.createElement('div', { className: "text-2xl font-bold direction-ltr text-left break-all" }, item.result),
              item.taxResult && (
                React.createElement('div', { className: "text-cyan-400 text-base mt-2" }, "الإجمالي مع الضريبة: ", item.taxResult)
              ),
               React.createElement('div', { className: "text-[var(--text-secondary)] opacity-70 text-xs mt-1" }, item.date, " - ", item.time)
            )
          ))
        )
      )
    )
  );
};

const sendSupportMessage = () => {
    const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd3Wx_1HGEUGRRqUP411cn_hQyR6lxvxw18F2Tb5rC-NPwiGw/viewform';
    window.open(formUrl, '_blank');
};

const SupportPanel = ({ isOpen, onClose }) => {
  return (
    React.createElement('div', { className: `fixed top-0 bottom-0 left-0 w-[320px] max-w-[85vw] bg-[var(--bg-panel)] text-[var(--text-primary)] z-50 p-5 shadow-2xl overflow-y-auto transition-transform duration-300 ease-in-out border-r-2 border-[var(--border-primary)] transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}` },
      React.createElement('div', { className: "flex justify-between items-center mb-6" },
        React.createElement('h2', { className: "text-[var(--accent-color)] text-2xl font-bold" }, "💬 دعم الآلة الحاسبة"),
        React.createElement('button', { onClick: onClose, className: "text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" }, "✕")
      ),
      React.createElement('div', { className: "bg-[var(--bg-inset-light)] rounded-2xl p-4 mb-6 border border-[var(--border-secondary)]" },
        React.createElement('p', { className: "text-[var(--text-secondary)] leading-relaxed text-base" },
            "مرحبًا! 👋 نحن متحمسون لسماع رأيك. يمكنك إرسال أي ملاحظة، اقتراح، أو بلاغ عن مشكلة.",
            React.createElement('br'), React.createElement('br'),
            React.createElement('span', { className: "text-[var(--accent-color)] font-bold" }, "✓ سيتم فتح نموذج دعم رسمي لإرسال رسالتك!")
        )
      ),
      React.createElement('button', { onClick: () => { sendSupportMessage(); onClose(); }, className: "w-full bg-gradient-to-br from-green-600/80 to-green-700/90 text-white border border-green-400/80 rounded-2xl p-4 text-lg font-bold cursor-pointer shadow-[0_7px_16px_rgba(0,0,0,0.35),0_0_22px_rgba(100,220,100,0.35)] hover:from-green-600" },
        "فتح نموذج الدعم الآن"
      )
    )
  );
};

const AboutPanel = ({ isOpen, onClose }) => {
  return (
    React.createElement('div', { className: `fixed top-0 bottom-0 right-0 w-[320px] max-w-[85vw] bg-[var(--bg-panel)] text-[var(--text-primary)] z-50 p-5 shadow-2xl overflow-y-auto transition-transform duration-300 ease-in-out border-l-2 border-[var(--border-primary)] transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}` },
      React.createElement('div', { className: "flex justify-between items-center mb-6" },
        React.createElement('h2', { className: "text-[var(--accent-color)] text-2xl font-bold" }, "ℹ️ حول الآلة الحاسبة"),
        React.createElement('button', { onClick: onClose, className: "text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" }, "✕")
      ),
      React.createElement('div', { className: "bg-[var(--bg-inset-light)] rounded-2xl p-4 mb-6 border border-[var(--border-secondary)]" },
        React.createElement('p', { className: "text-[var(--text-secondary)] leading-relaxed text-base" },
          "الآلة الحاسبة المتقدمة هي أداة حساب من الجيل التالي، مصممة للدقة وسهولة الاستخدام. تتميز بواجهة حديثة قابلة للتخصيص مع أوضاع فاتحة وداكنة.",
          React.createElement('br'), React.createElement('br'),
          "تقوم الآلة الحاسبة بتصحيح الأخطاء في تعبيراتك الرياضية بذكاء، محولة الأخطاء إلى فرص للتعلم.",
          React.createElement('br'), React.createElement('br'),
          "مع ميزات قوية مثل حساب الضرائب، وسجل عمليات دائم، والتركيز على تجربة مستخدم نظيفة، تهدف هذه الآلة الحاسبة إلى أن تكون الوحيدة التي ستحتاج إليها على الإطلاق."
        )
      ),
      React.createElement('div', { className: "text-center text-sm text-gray-400 dark:text-gray-500" },
        "الإصدار 1.4.1 © 2025"
      )
    )
  );
};

// --- App ---
const CURRENT_VERSION = '1.4.1';
const LATEST_VERSION = '1.4.1';
function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [notification, setNotification] = useState({ message: '', show: false });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [theme, setTheme] = useLocalStorage('calcTheme_v3', 'system');
  const [fontFamily, setFontFamily] = useLocalStorage('calcFontFamily_v2', 'Tajawal');
  const [fontScale, setFontScale] = useLocalStorage('calcFontScale_v2', 1);
  const [buttonTextColor, setButtonTextColor] = useLocalStorage('calcButtonTextColor_v1', null);
  const showNotification = useCallback((message) => {
    setNotification({ message, show: true });
    setTimeout(() => {
      setNotification({ message: '', show: false });
    }, 2500);
  }, []);
  const calculator = useCalculator({ showNotification });
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (theme === 'system') {
            document.documentElement.classList.toggle('dark', mediaQuery.matches);
            document.querySelector('meta[name="theme-color"]').setAttribute('content', mediaQuery.matches ? '#0a0e17' : '#FFFFFF');
        }
    };
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0a0e17');
    } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.querySelector('meta[name="theme-color"]').setAttribute('content', '#FFFFFF');
    } else { // system
        handleChange(); // set initial system theme
    }
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
  useEffect(() => {
      document.documentElement.style.setProperty('--font-family', fontFamily);
      document.documentElement.style.setProperty('--font-scale', fontScale);
  }, [fontFamily, fontScale]);
  useEffect(() => {
    if (buttonTextColor) {
        document.documentElement.style.setProperty('--button-text-color-custom', buttonTextColor);
    } else {
        document.documentElement.style.removeProperty('--button-text-color-custom');
    }
  }, [buttonTextColor]);
  useEffect(() => {
    if (LATEST_VERSION > CURRENT_VERSION) {
      setUpdateAvailable(true);
      setShowUpdateBanner(true);
    }
  }, []);
  const closeAllPanels = useCallback(() => {
    setIsSettingsOpen(false);
    setIsHistoryOpen(false);
    setIsSupportOpen(false);
    setIsAboutOpen(false);
  }, []);
  const onCheckForUpdates = () => {
    if (updateAvailable) {
        showNotification(`تحديث ${LATEST_VERSION} متاح للتثبيت!`);
    } else {
        showNotification("أنت تستخدم أحدث إصدار.");
    }
  };
  const createExportContent = useCallback((history, format) => {
    const getTaxModeLabel = (mode, rate) => {
        if (!mode) return "غير مفعلة";
        switch (mode) {
            case 'add-7': return "إضافة 7%"; case 'add-15': return "إضافة 15%";
            case 'divide-93': return "القسمة على 0.93"; case 'custom': return `مخصص ${rate}%`;
            default: return "غير معروف";
        }
    };
    if (format === 'txt') {
        const header = "سجل عمليات الآلة الحاسبة المتقدمة
";
        const content = history.map(item =>
            `التاريخ: ${item.date} - ${item.time}
` +
            `العملية: ${item.expression}
` +
            `النتيجة: ${item.result}
` +
            (item.taxResult ? `وضع الضريبة: ${getTaxModeLabel(item.taxMode, item.taxRate)}
النتيجة مع الضريبة: ${item.taxResult}
` : '') +
            "------------------------------------
"
        ).join('
');
        return header + content;
    }
    if (format === 'csv') {
        const escapeCsvCell = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
        const headers = ["التاريخ", "الوقت", "العملية", "النتيجة", "وضع الضريبة", "نسبة الضريبة", "النتيجة مع الضريبة"].map(escapeCsvCell).join(',');
        const rows = history.map(item => [
            item.date, item.time, item.expression, item.result,
            getTaxModeLabel(item.taxMode, item.taxRate), item.taxRate, item.taxResult
        ].map(escapeCsvCell).join(',')).join('
');
        return `\uFEFF${headers}
${rows}`;
    }
    return '';
  }, []);
  const handleExport = useCallback((format, startDate, endDate) => {
      const filteredHistory = calculator.history.filter(item => {
        if (!startDate && !endDate) return true;
        const [d, m, y] = item.date.split('/');
        if (!d || !m || !y) return false;
        const itemDate = new Date(`${y}-${m}-${d}`);
        if (isNaN(itemDate.getTime())) return false;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
        return true;
    });
    if (filteredHistory.length === 0) {
        showNotification("لا يوجد سجل للتصدير في هذا النطاق الزمني.");
        return;
    }
    const content = createExportContent(filteredHistory, format);
    const mimeType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.download = `calculator-history-${timestamp}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`جاري تصدير السجل كـ ${format.toUpperCase()}...`);
    closeAllPanels();
  }, [calculator.history, closeAllPanels, showNotification, createExportContent]);
  const anyPanelOpen = isSettingsOpen || isHistoryOpen || isSupportOpen || isAboutOpen;
  return (
    React.createElement('div', { className: "min-h-screen bg-cover bg-center bg-fixed", style: { background: 'var(--bg-primary-gradient)' } },
      React.createElement('div', { className: `flex justify-center items-center min-h-screen w-full font-sans relative pt-24 pb-8 md:pt-8` },
        showUpdateBanner && (
           React.createElement('div', { className: "absolute top-4 z-20 w-[calc(100%-2rem)] max-w-[420px] bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in-down" },
             React.createElement('div', null,
               React.createElement('h4', { className: "font-bold" }, `✨ تحديث جديد متاح! (v${LATEST_VERSION})`),
               React.createElement('p', { className: "text-sm opacity-90" }, "الميزات الجديدة والتحسينات بانتظارك.")
             ),
             React.createElement('div', { className: "flex items-center" },
               React.createElement('button', { onClick: () => { setShowUpdateBanner(false); }, className: "bg-white text-blue-600 font-bold py-1.5 px-3 rounded-lg text-sm mr-3 hover:bg-gray-200 transition-colors" }, "تثبيت"),
               React.createElement('button', { onClick: () => setShowUpdateBanner(false), className: "text-white text-2xl font-light hover:text-gray-200 transition-colors" }, "×")
             )
           )
        ),
        React.createElement(Calculator, {
          calculator: calculator,
          onToggleSettings: () => setIsSettingsOpen(v => !v),
          onToggleHistory: () => setIsHistoryOpen(v => !v),
          onShare: showNotification,
          entryCount: calculator.entryCount
        })
      ),
      React.createElement(Overlay, { show: anyPanelOpen, onClick: closeAllPanels }),
      React.createElement(SettingsPanel, {
        isOpen: isSettingsOpen,
        onClose: closeAllPanels,
        settings: calculator.settings,
        theme: theme,
        onThemeChange: setTheme,
        fontFamily: fontFamily,
        setFontFamily: setFontFamily,
        fontScale: fontScale,
        setFontScale: setFontScale,
        buttonTextColor: buttonTextColor,
        setButtonTextColor: setButtonTextColor,
        onOpenSupport: () => { closeAllPanels(); setIsSupportOpen(true); },
        onShowAbout: () => { closeAllPanels(); setIsAboutOpen(true); },
        onCheckForUpdates: onCheckForUpdates
      }),
      React.createElement(HistoryPanel, {
        isOpen: isHistoryOpen,
        onClose: closeAllPanels,
        history: calculator.history,
        onClearHistory: calculator.actions.clearHistory,
        onHistoryItemClick: (item) => {
          calculator.actions.loadFromHistory(item.expression);
          closeAllPanels();
        },
        onExportHistory: (start, end) => handleExport('txt', start, end),
        onExportCsvHistory: (start, end) => handleExport('csv', start, end)
      }),
      React.createElement(SupportPanel, { isOpen: isSupportOpen, onClose: closeAllPanels }),
      React.createElement(AboutPanel, { isOpen: isAboutOpen, onClose: closeAllPanels }),
      React.createElement(Notification, { message: notification.message, show: notification.show })
    )
  );
}

// --- Application Entry Point ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(App, null)
  )
);
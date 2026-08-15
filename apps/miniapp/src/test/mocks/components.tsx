import { createElement } from 'react'

// Mock of `@tarojs/components` mapping Taro components to plain DOM elements so
// @testing-library/react can render and query them in jsdom.

type Props = Record<string, any>

function makeElement(tag: string) {
  return ({ children, ...props }: Props) => createElement(tag, props, children)
}

export const View = makeElement('div')
export const Text = makeElement('span')

export const Button = ({ children, loading, disabled, ...props }: Props) =>
  createElement(
    'button',
    { ...props, disabled: disabled || loading, 'aria-busy': loading || undefined },
    children,
  )

export const Input = ({ onInput, value, ...props }: Props) =>
  createElement('input', {
    ...props,
    value: value ?? '',
    onChange: (e: any) => onInput && onInput({ detail: { value: e.target.value } }),
  })

// Taro `<Image>` maps to `<img>`; `ariaLabel` becomes `alt` so tests can use
// `getByAltText`. `mode`/`lazyLoad` are Taro-only props, not valid DOM attrs.
export const Image = ({ src, mode, lazyLoad, ariaLabel, onClick, ...props }: Props) =>
  createElement('img', { src, alt: ariaLabel, onClick, ...props })

// Taro `<Picker>` renders its children as the display; a click triggers the
// first range item (index 0) so selection flows can be exercised in tests.
export const Picker = ({ children, onChange, ...props }: Props) =>
  createElement('div', {
    ...props,
    onClick: () => onChange && onChange({ detail: { value: 0 } }),
  }, children)

// Taro `<Slider>` maps to `<input type="range">`; onChange emits the Taro-style
// `{ detail: { value } }` payload so count sliders can be driven in tests.
export const Slider = ({ value, min, max, onChange, ...props }: Props) =>
  createElement('input', {
    ...props,
    type: 'range',
    value: value ?? min,
    min,
    max,
    onChange: (e: any) =>
      onChange && onChange({ detail: { value: Number(e.target.value) } }),
  })

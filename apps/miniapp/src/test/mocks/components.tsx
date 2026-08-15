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

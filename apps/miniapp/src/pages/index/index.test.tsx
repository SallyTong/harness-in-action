import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import Home from './index'

describe('Home > 首页占位', () => {
  it('renders placeholder state', () => {
    render(<Home />)
    expect(screen.getByText('批改')).toBeInTheDocument()
    expect(screen.getByText('功能建设中')).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, StatusBadge, EmptyState, Field, Input } from './index';

describe('UI kit', () => {
  it('Button renders and fires clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Button is disabled while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('StatusBadge humanizes status values', () => {
    render(<StatusBadge status="changes_requested" />);
    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
  });

  it('EmptyState shows title, description and action', () => {
    render(<EmptyState title="Nothing here" description="Add something." action={<button>Add</button>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('Field wires label and announces errors', () => {
    render(
      <Field label="Email" error="Email is required." htmlFor="email">
        <Input id="email" />
      </Field>
    );
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required.');
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import WelcomeScreen from '../WelcomeScreen';

describe('WelcomeScreen Component', () => {
  it('renders welcome message with the correct app name', () => {
    render(<WelcomeScreen />);
    
    // Check if the welcome message is in the document
    const welcomeElement = screen.getByText(/Welcome to/i);
    expect(welcomeElement).toBeInTheDocument();
    
    const appNameElement = screen.getByText(/Chat App/i);
    expect(appNameElement).toBeInTheDocument();
  });

  it('renders the instruction text to select a conversation', () => {
    render(<WelcomeScreen />);
    
    const instructionElement = screen.getByText(/Select a conversation from the sidebar list to start messaging/i);
    expect(instructionElement).toBeInTheDocument();
  });
});

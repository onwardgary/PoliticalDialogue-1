# Suara.sg - Political Debate Platform

## Overview

Suara.sg is a full-stack political debate platform built with Node.js, Express, React, and PostgreSQL. The application allows users to engage in political debates with AI-powered chatbots representing different Singaporean political parties. The platform features real-time chat interfaces, debate summarization, and voting mechanisms to foster civic engagement.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend and backend concerns:

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session-based auth
- **AI Integration**: OpenAI GPT-4 for chat responses and debate summarization
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: Redux Toolkit for complex debate state, React Query for server state
- **UI Components**: Shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **Build Tool**: Vite for development and production builds

### Database Schema
The application uses Drizzle ORM with PostgreSQL, featuring:
- **Users**: Authentication and user management
- **Parties**: Political party information (PAP, WP, PSP)
- **Debates**: Chat sessions with messages stored as JSON
- **Votes**: User voting on debate outcomes
- **Knowledge Base**: Admin-managed content for AI responses
- **Aggregate Summaries**: Trending topics and analytics

## Key Components

### Chat System
- Real-time debate interface with typing indicators
- Message polling for AI responses
- Support for both authenticated and guest users
- Debate timeout mechanisms (15-minute inactivity limit)

### AI Integration
- OpenAI GPT-4 for party-specific responses
- Search-enabled model for current events
- Automated debate summarization with multi-step analysis
- Dynamic system prompts based on political party positions

### Authentication
- Session-based authentication with PostgreSQL storage
- Guest user support for unauthenticated debates
- Admin roles for knowledge base management
- Secure password hashing with scrypt

### Debate Management
- Secure debate URLs with nanoid-generated identifiers
- Configurable debate rounds (3, 5, or 7 rounds)
- Automatic debate completion and summary generation
- Vote collection on debate outcomes

## Data Flow

1. **User Interaction**: Users select a political party and start a debate
2. **Debate Creation**: System creates a new debate record with secure ID
3. **Message Exchange**: Real-time chat with AI responses via OpenAI API
4. **Polling Mechanism**: Frontend polls for AI responses every 2 seconds
5. **Debate Completion**: After maximum rounds, system generates summary
6. **Summary Generation**: Multi-step AI analysis of debate arguments
7. **Vote Collection**: Users can vote on debate outcomes
8. **Analytics**: Aggregate summaries track trending topics

## External Dependencies

### Core Dependencies
- **OpenAI API**: GPT-4 models for chat and summarization
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit**: Development and deployment platform

### Frontend Libraries
- React ecosystem (React Query, React Hook Form, Wouter)
- UI components (Radix UI, Tailwind CSS, Lucide icons)
- State management (Redux Toolkit)

### Backend Libraries
- Express.js with TypeScript support
- Drizzle ORM for database operations
- Passport.js for authentication
- Various utility libraries (nanoid, date-fns, zod)

## Deployment Strategy

The application is configured for deployment on Replit with the following setup:

### Development
- `npm run dev`: Starts development server with hot reloading
- Vite dev server for frontend with HMR
- TSX for TypeScript execution in development

### Production Build
- `npm run build`: Builds frontend with Vite and bundles backend with esbuild
- Static files served from `dist/public`
- Express server serves both API and static assets

### Environment Configuration
- PostgreSQL database provisioned automatically
- Session secrets and API keys managed via environment variables
- Port configuration for Replit deployment (port 5000 → 80)

## Changelog

- June 24, 2025: Implemented invite-only user management system
  - Added admin user creation interface at `/admin/users`
  - Created login buttons with "By Invitation Only" messaging
  - Enabled authentication flows while maintaining guest access
  - Added user role management and safety checks
- June 16, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
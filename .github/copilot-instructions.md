# SignEase - AI Agent Coding Instructions

## Project Overview

SignEase is a modern electronic signature platform built with React 19, TypeScript, and Vite. It provides secure document signing with cryptographic verification, eIDAS/PAdES compliance, and a complete workflow for document preparation, signing, and verification.

## Architecture

### Tech Stack
- **Frontend**: React 19 with TypeScript, Vite build tool, Tailwind CSS 4
- **Routing**: React Router DOM v7
- **PDF Processing**: pdf-lib, jspdf, pdfjs-dist (4.4.168), @react-pdf/renderer
- **Document Processing**: html2canvas, mammoth (Word documents)
- **Cryptography**: jose (JWT), node-forge (P12 certificates)
- **Email**: emailjs-com (verification emails)
- **UI Components**: lucide-react (icons), react-signature-canvas

### Directory Structure
- `/pages` - Main application pages (Inbox, Prepare, Sign, Verify)
- `/components` - Reusable React components
- `/services` - Business logic and API integrations
- `/utils` - Helper functions and utilities
- `/config` - Configuration files
- `/docs` - Comprehensive documentation (see recommended reading order below)
- `/public` - Static assets
- `/scripts` - Build and deployment scripts

## Key Features & Workflows

### 1. Document Preparation Flow
- Upload PDF/Word documents (mammoth for DOCX conversion)
- Add signature fields, text fields, checkboxes
- Position elements with drag-and-drop interface
- Generate shareable signing links

### 2. Signature Flow
- Multiple signature types: drawn, typed, uploaded image
- Cryptographic signing with P12 certificates
- Homothetic signature resizing (maintains aspect ratio)
- Real-time PDF field population

### 3. Verification Flow
- Email-based verification links (EmailJS integration)
- Cryptographic signature validation
- Document integrity checking
- Visual verification interface

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production (TypeScript + Vite)
npm run preview      # Preview production build
```

## Critical Patterns & Conventions

### PDF Processing
- Use `pdf-lib` for PDF manipulation and field insertion
- Use `pdfjs-dist@4.4.168` specifically (version matters for worker compatibility)
- All PDF operations are client-side for security
- See `docs/LIBRAIRIES-SIGNATURE.md` for library selection rationale

### Signature Handling
- Signatures maintain aspect ratio during resize (homothetic transformation)
- Canvas-based signature capture with `react-signature-canvas`
- P12 certificate support via `node-forge` for cryptographic signatures
- See `docs/SIGNATURES-EIDAS.md` for eIDAS compliance details

### Security Practices
- Client-side cryptographic operations (no server-side key storage)
- CORS configuration via `cors.json` and `configure-cors.bat`
- Secure key management patterns in `docs/CONFIGURATION-PRODUCTION.md`
- Audit security checklist in `docs/AUDIT-SECURITE-SIGNATURES.md`

### State Management
- React hooks for local state (no Redux/external state library)
- Context API for shared state when needed
- URL parameters for document/session routing

## Important Documentation Files

Recommended reading order:
1. `README.md` - Quick start and overview
2. `docs/IMPLEMENTATION-COMPLETE.md` - Complete feature implementation guide
3. `docs/SIGNATURES-EIDAS.md` - eIDAS compliance and signature standards
4. `docs/LIBRAIRIES-SIGNATURE.md` - Library selection and rationale
5. `docs/DEPLOIEMENT.md` - Deployment procedures
6. `docs/CONFIGURATION-PRODUCTION.md` - Production configuration
7. `docs/AUDIT-SECURITE-SIGNATURES.md` - Security audit checklist

Other useful docs:
- `docs/FIREBASE.md` - Firebase integration (if used)
- `docs/CONFIGURATION-CORS.md` - CORS setup
- `docs/DEPLOIEMENT-BACKEND-SIGNATURE.md` - Backend signature deployment
- `docs/INTEGRATION-VERIFY-EMAILJS.md` - EmailJS integration
- `docs/BUGS ET AMÉLIORATIONS.md` - Known issues and improvements

## Common Pitfalls to Avoid

1. **PDF Worker Issues**: Use exact pdfjs-dist@4.4.168 version for worker compatibility
2. **Signature Aspect Ratio**: Always maintain homothetic resizing to prevent distortion
3. **CORS Configuration**: Configure properly for file uploads (see `cors.json`)
4. **Certificate Handling**: Never commit P12 certificates or private keys
5. **Tailwind CSS**: Using v4 syntax (check migration guide for v3→v4 changes)

## When Adding Features

- Follow React 19 patterns (new hooks, concurrent features)
- TypeScript strict mode is enabled - maintain type safety
- All PDF operations should remain client-side
- Update relevant documentation in `/docs`
- Test signature workflows end-to-end (prepare → sign → verify)
- Ensure eIDAS compliance for cryptographic operations

## Production Deployment

- Build with `npm run build` (outputs to `/dist`)
- Configured for Netlify deployment (see `netlify.toml`)
- Environment variables for EmailJS configuration
- See `docs/ETAPES-PRODUCTION.md` for complete deployment steps

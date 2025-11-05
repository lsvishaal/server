# HrGenie Editor - Server

Backend API server for collaborative document editing with AI assistance.

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (via Docker or local installation)
- Google Gemini API key

### Development

1. **Start MongoDB:**
```bash
docker compose up database -d
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
Create a `.env` file in the root directory:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/collab-editor
JWT_SECRET=your-secret-key-here
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=development
```

4. **Seed demo data (optional):**
```bash
npm run seed:demo
```
Creates a demo account: `demo@hrgenie.com` / `demo123`

5. **Start development server:**
```bash
npm run dev
```
Server will run on http://localhost:5000

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Documents
- `GET /api/documents` - Get all user documents
- `GET /api/documents/:id` - Get specific document
- `POST /api/documents` - Create new document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/share` - Share document

### AI Assistance
- `POST /api/ai/grammar-check` - Check grammar
- `POST /api/ai/enhance` - Enhance writing
- `POST /api/ai/summarize` - Summarize text
- `POST /api/ai/complete` - Auto-complete text
- `POST /api/ai/suggestions` - Get writing suggestions

### WebSocket Events
- `join-document` - Join document room
- `leave-document` - Leave document room
- `text-change` - Broadcast text changes
- `cursor-move` - Broadcast cursor position
- `users-update` - Active users list
- `user-joined` - User joined notification
- `user-left` - User left notification

## Tech Stack

- Node.js + Express 5
- TypeScript 5.9
- MongoDB 8 + Mongoose
- Socket.io 4
- JWT Authentication
- Google Gemini AI API
- Winston Logger
- Helmet Security
- Rate Limiting

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run seed:demo` - Seed database with demo data
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Database Management

```bash
# Start MongoDB
docker compose up database -d

# Stop MongoDB
docker compose down

# View logs
docker compose logs database -f
```

## Azure Deployment

For Azure App Service deployment:
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Set environment variables in Azure portal
4. Use Azure Database for MongoDB or MongoDB Atlas

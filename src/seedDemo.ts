import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import Document from './models/Document';

dotenv.config();

const DEMO_USER = {
  name: 'Demo User',
  email: 'demo@hrgenie.com',
  password: 'demo123'
};

async function seedDemo() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-editor');
    console.log('Connected to MongoDB');

    // Check if demo user exists
    let user = await User.findOne({ email: DEMO_USER.email });
    
    if (user) {
      console.log('Demo user already exists');
    } else {
      // Create demo user (password will be hashed automatically by pre-save hook)
      user = await User.create({
        name: DEMO_USER.name,
        email: DEMO_USER.email,
        password: DEMO_USER.password  // Will be hashed by the model
      });
      console.log('✅ Demo user created');
    }

    // Check if demo documents exist
    const existingDocs = await Document.find({ owner: user._id });
    
    if (existingDocs.length > 0) {
      console.log(`Demo user already has ${existingDocs.length} documents`);
    } else {
      // Create sample documents
      const sampleDocs = [
        {
          title: 'Welcome to HrGenie! 🎉',
          content: `<h1>Welcome to HrGenie Collaborative Editor!</h1>
<p><br></p>
<h2>What is HrGenie?</h2>
<p>HrGenie is a real-time collaborative text editor with AI-powered writing assistance. Think of it as Google Docs meets AI superpowers!</p>
<p><br></p>
<h2>✨ Key Features:</h2>
<ul>
  <li><strong>Real-time Collaboration</strong> - Multiple users can edit the same document simultaneously</li>
  <li><strong>AI Writing Assistant</strong> - Powered by Google Gemini 2.0 for grammar checking, text enhancement, and more</li>
  <li><strong>Auto-save</strong> - Your work is automatically saved every 30 seconds</li>
  <li><strong>User Presence</strong> - See who else is editing in real-time</li>
  <li><strong>Rich Text Editing</strong> - Full formatting capabilities with Quill.js</li>
</ul>
<p><br></p>
<h2>🤖 AI Features:</h2>
<ol>
  <li><strong>Grammar Check</strong> - Get detailed feedback on grammar and style</li>
  <li><strong>Enhance Text</strong> - Improve clarity and readability</li>
  <li><strong>Summarize</strong> - Get concise summaries of your text</li>
  <li><strong>Auto-complete</strong> - Smart text completion suggestions</li>
  <li><strong>Writing Suggestions</strong> - Get creative writing ideas</li>
</ol>
<p><br></p>
<h2>🚀 How to Use:</h2>
<p>1. Select any text in this document</p>
<p>2. Click the "🤖 AI Assistant" button in the toolbar</p>
<p>3. Try out different AI features!</p>
<p>4. Click "Insert into Document" to add the AI-generated content</p>
<p><br></p>
<p><em>Try selecting this paragraph and asking the AI to enhance it!</em></p>
<p><br></p>
<h2>📝 Tips:</h2>
<ul>
  <li>Use the formatting toolbar to style your text</li>
  <li>Your work auto-saves, but you can manually save anytime</li>
  <li>Share documents with collaborators for real-time editing</li>
  <li>Watch the user list on the left to see who's online</li>
</ul>
<p><br></p>
<p><strong>Happy writing! 🎊</strong></p>`,
          owner: user._id,
          collaborators: []
        },
        {
          title: 'Project Ideas Brainstorm',
          content: `<h1>Brainstorming Session - Q4 2025</h1>
<p><br></p>
<h2>Project Ideas:</h2>
<ul>
  <li>AI-powered chatbot for customer support</li>
  <li>Mobile app for team collaboration</li>
  <li>Dashboard analytics tool</li>
  <li>API integration platform</li>
</ul>
<p><br></p>
<h2>Next Steps:</h2>
<p>1. Prioritize based on impact</p>
<p>2. Assign team leads</p>
<p>3. Set timeline and milestones</p>`,
          owner: user._id,
          collaborators: []
        },
        {
          title: 'Meeting Notes - Tech Review',
          content: `<h1>Technical Review Meeting</h1>
<p><strong>Date:</strong> November 5, 2025</p>
<p><strong>Attendees:</strong> Engineering Team</p>
<p><br></p>
<h2>Agenda:</h2>
<ol>
  <li>Code review process improvements</li>
  <li>New technology stack evaluation</li>
  <li>Performance optimization strategies</li>
</ol>
<p><br></p>
<h2>Discussion Points:</h2>
<p>The team discussed moving to a microservices architecture...</p>`,
          owner: user._id,
          collaborators: []
        }
      ];

      await Document.insertMany(sampleDocs);
      console.log('✅ Created 3 sample documents');
    }

    console.log('\n🎉 Demo account is ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: demo@hrgenie.com');
    console.log('🔑 Password: demo123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding demo data:', error);
    process.exit(1);
  }
}

seedDemo();

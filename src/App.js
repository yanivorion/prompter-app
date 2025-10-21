import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import './App.css';

// Lucide React Icons (shadcn uses these)
import { 
  Menu, 
  ChevronDown, 
  ChevronRight,
  File, 
  FolderOpen,
  Search,
  Copy,
  Download,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  X,
  Edit3,
  Save,
  FolderPlus,
  GripVertical
} from 'lucide-react';

// ============================================
// IndexedDB Setup
// ============================================

const DB_NAME = 'PromptOrganizerDB';
const DB_VERSION = 1;
const STORE_NAME = 'prompts';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

const savePromptToDB = async (promptData) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const data = {
      ...promptData,
      updatedAt: new Date().toISOString()
    };
    
    if (promptData.id) {
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      data.createdAt = new Date().toISOString();
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  });
};

const loadPromptsFromDB = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deletePromptFromDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// Main App Component
// ============================================

function App() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [parseMode, setParseMode] = useState(false);
  const [rawPrompt, setRawPrompt] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [editingSubject, setEditingSubject] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRefs = useRef({});

  // New state for database functionality
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [currentPromptId, setCurrentPromptId] = useState(null);
  const [currentPromptName, setCurrentPromptName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [draggedSection, setDraggedSection] = useState(null);

  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  // Load saved prompts on mount
  useEffect(() => {
    loadSavedPrompts();
  }, []);

  const loadSavedPrompts = async () => {
    try {
      const prompts = await loadPromptsFromDB();
      setSavedPrompts(prompts);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  };

  const handleSavePrompt = async () => {
    if (!currentPromptName.trim()) {
      alert('Please enter a prompt name');
      return;
    }

    try {
      const promptData = {
        id: currentPromptId,
        name: currentPromptName,
        sections: sections,
        rawPrompt: rawPrompt
      };
      
      const id = await savePromptToDB(promptData);
      setCurrentPromptId(id);
      await loadSavedPrompts();
      setShowSaveDialog(false);
      alert('Prompt saved successfully!');
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Error saving prompt');
    }
  };

  const handleLoadPrompt = async (promptId) => {
    try {
      const prompt = savedPrompts.find(p => p.id === promptId);
      if (prompt) {
        setSections(prompt.sections);
        setRawPrompt(prompt.rawPrompt || '');
        setCurrentPromptId(prompt.id);
        setCurrentPromptName(prompt.name);
        setShowLoadDialog(false);
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
      alert('Error loading prompt');
    }
  };

  const handleDeletePrompt = async (promptId) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    
    try {
      await deletePromptFromDB(promptId);
      await loadSavedPrompts();
      if (currentPromptId === promptId) {
        setCurrentPromptId(null);
        setCurrentPromptName('');
        setSections([]);
        setRawPrompt('');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      alert('Error deleting prompt');
    }
  };

  const handleNewPrompt = () => {
    if (sections.length > 0 || rawPrompt) {
      if (!confirm('Create new prompt? Unsaved changes will be lost.')) return;
    }
    setSections([]);
    setRawPrompt('');
    setCurrentPromptId(null);
    setCurrentPromptName('');
  };

  const parsePrompt = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    let currentH1 = null;
    let currentH2 = null;
    let currentH3 = null;
    let buffer = [];
    let inCodeBlock = false;
    let inXmlBlock = false;
    let xmlBlockName = '';

    const createSection = (level, title, content = '') => ({
      id: Date.now() + Math.random(),
      level,
      title: title.trim(),
      content: content.trim(),
      visible: true,
      subjects: []
    });

    const saveBuffer = () => {
      const content = buffer.join('\n').trim();
      if (currentH3) {
        currentH3.content = content;
      } else if (currentH2) {
        currentH2.content = content;
      } else if (currentH1) {
        currentH1.content = content;
      }
      buffer = [];
    };

    lines.forEach((line) => {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        buffer.push(line);
        return;
      }

      if (inCodeBlock) {
        buffer.push(line);
        return;
      }

      const xmlOpenMatch = line.match(/^<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
      if (xmlOpenMatch && !inXmlBlock) {
        saveBuffer();
        inXmlBlock = true;
        xmlBlockName = xmlOpenMatch[1];
        currentH2 = createSection(2, xmlBlockName);
        if (currentH1) {
          currentH1.subjects.push(currentH2);
        } else {
          parsed.push(currentH2);
        }
        currentH3 = null;
        return;
      }

      const xmlCloseMatch = line.match(/^<\/([a-zA-Z_][a-zA-Z0-9_]*)>$/);
      if (xmlCloseMatch && inXmlBlock && xmlCloseMatch[1] === xmlBlockName) {
        saveBuffer();
        inXmlBlock = false;
        xmlBlockName = '';
        currentH2 = null;
        currentH3 = null;
        return;
      }

      if (inXmlBlock) {
        buffer.push(line);
        return;
      }

      const h1Match = line.match(/^#\s+(.+)$/);
      if (h1Match) {
        saveBuffer();
        currentH1 = createSection(1, h1Match[1]);
        parsed.push(currentH1);
        currentH2 = null;
        currentH3 = null;
        return;
      }

      const h2Match = line.match(/^##\s+(.+)$/);
      if (h2Match) {
        saveBuffer();
        currentH2 = createSection(2, h2Match[1]);
        if (currentH1) {
          currentH1.subjects.push(currentH2);
        } else {
          parsed.push(currentH2);
        }
        currentH3 = null;
        return;
      }

      const h3Match = line.match(/^###\s+(.+)$/);
      if (h3Match) {
        saveBuffer();
        currentH3 = createSection(3, h3Match[1]);
        if (currentH2) {
          currentH2.subjects.push(currentH3);
        } else if (currentH1) {
          currentH1.subjects.push(currentH3);
        } else {
          parsed.push(currentH3);
        }
        return;
      }

      buffer.push(line);
    });

    saveBuffer();
    return parsed;
  };

  const handleParse = () => {
    if (!rawPrompt.trim()) {
      alert('Please paste your prompt first');
      return;
    }
    const parsed = parsePrompt(rawPrompt);
    setSections(parsed);
    setParseMode(false);
    alert('Prompt parsed successfully!');
  };

  const toggleSubject = (sectionId) => {
    setExpandedSubjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleVisibility = (sectionId) => {
    const updateVisibility = (items) => {
      return items.map((item) => {
        if (item.id === sectionId) {
          return { ...item, visible: !item.visible };
        }
        if (item.subjects && item.subjects.length > 0) {
          return { ...item, subjects: updateVisibility(item.subjects) };
        }
        return item;
      });
    };
    setSections(updateVisibility(sections));
  };

  const deleteSection = (sectionId) => {
    const deleteFromTree = (items) => {
      return items
        .filter((item) => item.id !== sectionId)
        .map((item) => ({
          ...item,
          subjects: item.subjects ? deleteFromTree(item.subjects) : []
        }));
    };
    setSections(deleteFromTree(sections));
  };

  const handleMoveSection = (sectionId, direction) => {
    const moveSectionInTree = (items, parentSubjects = null) => {
      const index = items.findIndex(item => item.id === sectionId);
      
      if (index !== -1) {
        const newItems = [...items];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex >= 0 && targetIndex < newItems.length) {
          [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        }
        
        return newItems;
      }
      
      return items.map(item => ({
        ...item,
        subjects: item.subjects ? moveSectionInTree(item.subjects, item.subjects) : []
      }));
    };
    
    setSections(moveSectionInTree(sections));
  };

  const generatePromptText = () => {
    const generateText = (items, level = 1) => {
      let text = '';
      items.forEach((item) => {
        if (!item.visible) return;
        
        if (level === 1) {
          text += `# ${item.title}\n\n`;
        } else if (level === 2) {
          if (item.title.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
            text += `<${item.title}>\n`;
            if (item.content) text += `${item.content}\n`;
            if (item.subjects && item.subjects.length > 0) {
              text += generateText(item.subjects, level + 1);
            }
            text += `</${item.title}>\n\n`;
          } else {
            text += `## ${item.title}\n\n`;
            if (item.content) text += `${item.content}\n\n`;
            if (item.subjects && item.subjects.length > 0) {
              text += generateText(item.subjects, level + 1);
            }
          }
        } else {
          text += `${'#'.repeat(level)} ${item.title}\n\n`;
          if (item.content) text += `${item.content}\n\n`;
          if (item.subjects && item.subjects.length > 0) {
            text += generateText(item.subjects, level + 1);
          }
        }
      });
      return text;
    };
    return generateText(sections);
  };

  const copyToClipboard = () => {
    const text = generatePromptText();
    navigator.clipboard.writeText(text);
    alert('Prompt copied to clipboard!');
  };

  const downloadPrompt = () => {
    const text = generatePromptText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPromptName || 'prompt'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSections = sections.filter((section) =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderSection = (section, level = 0) => {
    const hasSubjects = section.subjects && section.subjects.length > 0;
    const isExpanded = expandedSubjects.has(section.id);

    return (
      <div key={section.id} style={{ marginLeft: `${level * 12}px` }}>
        <motion.div
          className={`section-item ${selectedSection?.id === section.id ? 'active' : ''}`}
          onClick={() => setSelectedSection(section)}
          initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          whileHover={!prefersReducedMotion ? { x: 2 } : {}}
        >
          <div className="section-header">
            <div className="section-left">
              <GripVertical size={14} className="drag-handle" style={{ opacity: 0.4, marginRight: 4 }} />
              {hasSubjects && (
                <button
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSubject(section.id);
                  }}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              <span className="section-icon">
                {hasSubjects ? <FolderOpen size={14} /> : <File size={14} />}
              </span>
              <span className="section-title">{section.title}</span>
            </div>
            <div className="section-actions">
              <button
                className="action-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveSection(section.id, 'up');
                }}
                aria-label="Move up"
                title="Move up"
              >
                <ArrowUp size={12} />
              </button>
              <button
                className="action-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveSection(section.id, 'down');
                }}
                aria-label="Move down"
                title="Move down"
              >
                <ArrowDown size={12} />
              </button>
              <button
                className="action-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisibility(section.id);
                }}
                aria-label={section.visible ? 'Hide' : 'Show'}
                title={section.visible ? 'Hide' : 'Show'}
              >
                {section.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button
                className="action-button delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${section.title}"?`)) {
                    deleteSection(section.id);
                  }
                }}
                aria-label="Delete"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </motion.div>
        
        {isExpanded && hasSubjects && (
          <AnimatePresence>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {section.subjects.map((subject) => renderSection(subject, level + 1))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <motion.div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="dialog-header">
              <h3>Save Prompt</h3>
              <button onClick={() => setShowSaveDialog(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="dialog-content">
              <input
                type="text"
                placeholder="Enter prompt name..."
                value={currentPromptName}
                onChange={(e) => setCurrentPromptName(e.target.value)}
                className="dialog-input"
                autoFocus
              />
            </div>
            <div className="dialog-actions">
              <button className="button secondary" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </button>
              <button className="button primary" onClick={handleSavePrompt}>
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Load Dialog */}
      {showLoadDialog && (
        <div className="dialog-overlay" onClick={() => setShowLoadDialog(false)}>
          <motion.div
            className="dialog large"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="dialog-header">
              <h3>Load Prompt</h3>
              <button onClick={() => setShowLoadDialog(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="dialog-content">
              {savedPrompts.length === 0 ? (
                <p style={{ color: '#6C757D', textAlign: 'center', padding: '20px' }}>
                  No saved prompts yet
                </p>
              ) : (
                <div className="prompts-list">
                  {savedPrompts.map((prompt) => (
                    <div key={prompt.id} className="prompt-item">
                      <div className="prompt-info">
                        <h4>{prompt.name}</h4>
                        <p>{new Date(prompt.updatedAt).toLocaleString()}</p>
                      </div>
                      <div className="prompt-actions">
                        <button
                          className="button small primary"
                          onClick={() => handleLoadPrompt(prompt.id)}
                        >
                          Load
                        </button>
                        <button
                          className="button small delete"
                          onClick={() => handleDeletePrompt(prompt.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Sidebar */}
      <motion.div
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        initial={false}
        animate={{ width: sidebarCollapsed ? '60px' : '280px' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="sidebar-header">
          <motion.button
            className="menu-button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Menu size={20} />
          </motion.button>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Prompt Organizer
              </motion.h2>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="sidebar-content"
            >
              {/* Toolbar */}
              <div className="toolbar">
                <button
                  className="toolbar-button"
                  onClick={handleNewPrompt}
                  title="New Prompt"
                >
                  <Plus size={16} />
                  New
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => setShowSaveDialog(true)}
                  title="Save Prompt"
                >
                  <Save size={16} />
                  Save
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => setShowLoadDialog(true)}
                  title="Load Prompt"
                >
                  <FolderOpen size={16} />
                  Load
                </button>
              </div>

              {/* Search */}
              <div className="search-container">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search sections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Parse Mode Toggle */}
              {!parseMode && sections.length === 0 && (
                <motion.button
                  className="parse-button"
                  onClick={() => setParseMode(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={16} />
                  Paste & Parse Prompt
                </motion.button>
              )}

              {parseMode && (
                <motion.div
                  className="parse-container"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <textarea
                    className="parse-textarea"
                    placeholder="Paste your full prompt here..."
                    value={rawPrompt}
                    onChange={(e) => setRawPrompt(e.target.value)}
                    autoFocus
                  />
                  <div className="parse-actions">
                    <button className="button secondary" onClick={() => setParseMode(false)}>
                      Cancel
                    </button>
                    <button className="button primary" onClick={handleParse}>
                      Parse
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Sections List */}
              <div className="sections-list">
                {filteredSections.map((section) => renderSection(section))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Content */}
      <div className="main-content">
        {/* Tab Bar */}
        <div className="tab-bar">
          <button
            className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            <Edit3 size={16} />
            Edit
          </button>
          <button
            className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={16} />
            Preview
          </button>
          <div className="tab-actions">
            {currentPromptName && (
              <span className="prompt-name">{currentPromptName}</span>
            )}
            <button className="icon-button" onClick={copyToClipboard} title="Copy to clipboard">
              <Copy size={16} />
            </button>
            <button className="icon-button" onClick={downloadPrompt} title="Download">
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="content-area">
          {activeTab === 'edit' && selectedSection && (
            <motion.div
              className="editor-panel"
              initial={prefersReducedMotion ? false : { opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div className="editor-header">
                <h3>{selectedSection.title}</h3>
              </div>
              <textarea
                className="editor-textarea"
                value={selectedSection.content}
                onChange={(e) => {
                  const updateContent = (items) => {
                    return items.map((item) => {
                      if (item.id === selectedSection.id) {
                        return { ...item, content: e.target.value };
                      }
                      if (item.subjects && item.subjects.length > 0) {
                        return { ...item, subjects: updateContent(item.subjects) };
                      }
                      return item;
                    });
                  };
                  setSections(updateContent(sections));
                  setSelectedSection({ ...selectedSection, content: e.target.value });
                }}
                placeholder="Edit section content..."
              />
            </motion.div>
          )}

          {activeTab === 'edit' && !selectedSection && (
            <div className="empty-state">
              <File size={48} style={{ opacity: 0.3 }} />
              <p>Select a section to edit</p>
            </div>
          )}

          {activeTab === 'preview' && (
            <motion.div
              className="preview-panel"
              initial={prefersReducedMotion ? false : { opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <pre className="preview-content">{generatePromptText()}</pre>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
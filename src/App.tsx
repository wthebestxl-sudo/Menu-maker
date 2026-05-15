import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MenuItem } from './types';
import { Trash2, Download, Image as ImageIcon, Sparkles, X, Check, GripVertical, LayoutGrid, Bold, Italic, Underline, ArrowLeftRight, BookOpen, BookmarkPlus, Loader2, Settings, Plus } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { cn } from './lib/utils';
import Cropper from 'react-easy-crop';
import getCroppedImg from './lib/cropImage';
import { Reorder } from 'motion/react';
import { RichTextEdit } from './components/RichTextEdit';
import { MenuLibrary } from './components/MenuLibrary';
import { PresetMenu } from './data/presetMenus';
import { supabase } from './lib/supabase';

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23f4d068" opacity="0.2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%235c3a21">คลิกเพื่อเปลี่ยนรูปภาพ</text></svg>';

const loadState = () => {
  try {
    const saved = localStorage.getItem('menuAppState');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
        if (parsed.qrData && (parsed.qrData.position === 'left' || parsed.qrData.position === 'right')) {
          parsed.qrData.position = parsed.qrData.position === 'left' ? 'bottom-left' : 'bottom-right';
        }
        return parsed;
      } else {
        localStorage.removeItem('menuAppState');
      }
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
  return null;
};
const initialState = loadState();

export default function App() {
  const [items, setItems] = useState<MenuItem[]>(initialState?.items || []);
  const [isExporting, setIsExporting] = useState(false);
  const [isLibraryEditMode, setIsLibraryEditMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Header State
  const [menuTitle, setMenuTitle] = useState(initialState?.menuTitle || 'เมนูวันนี้');
  const [menuDate, setMenuDate] = useState(() => {
    if (initialState?.menuDate) return initialState.menuDate;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const year = tomorrow.getFullYear();
    return `วันที่ ${day}/${month}/${year}`;
  });
  const [menuSubtitle, setMenuSubtitle] = useState(initialState?.menuSubtitle || 'เริ่มออกส่ง 12:00 นะคะ');
  const [badgeText, setBadgeText] = useState(initialState?.badgeText || 'ทุกเมนูมีข้าวนะคะ');

  // Crop State
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [editAspectRatio, setEditAspectRatio] = useState<'16:9' | '1:1'>('16:9');
  
  // Layout State
  const [layout, setLayout] = useState<'grid-1' | 'grid-2' | 'grid-3'>(initialState?.layout || 'grid-2');

  // Scaling State for Mobile Preview
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  // Menu Library State
  const [isMenuLibraryOpen, setIsMenuLibraryOpen] = useState(false);

  // Replace Image State
  const replaceImageRef = useRef<HTMLInputElement>(null);
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);

  // Saving State
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  useEffect(() => {
    const stateToSave = { items, layout, menuTitle, menuDate, menuSubtitle, badgeText, timestamp: Date.now() };
    localStorage.setItem('menuAppState', JSON.stringify(stateToSave));
  }, [items, layout, menuTitle, menuDate, menuSubtitle, badgeText]);

  // QR functionality removed

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const targetWidth = 800;
        const padding = window.innerWidth < 768 ? 32 : 64;
        const availableWidth = containerWidth - padding;
        const newScale = Math.min(1, availableWidth / targetWidth);
        setScale(newScale);
      }
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    updateScale();
    return () => observer.disconnect();
  }, []);

  // Rich Text Toolbar State
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        let isEditable = false;
        let node = selection.anchorNode;
        while (node && node.nodeType !== Node.DOCUMENT_NODE) {
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).getAttribute('contenteditable') === 'true') {
             isEditable = true;
             break;
          }
          node = node.parentNode;
        }

        if (isEditable) {
          setShowToolbar(true);
          setToolbarPos({
            top: rect.top - 46,
            left: rect.left + rect.width / 2,
          });
        } else {
          setShowToolbar(false);
        }
      } else {
        setShowToolbar(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const formatText = (command: string) => {
    document.execCommand(command, false);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    if (!editingItem || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(editingItem.url, croppedAreaPixels);
      setItems(items.map(item => item.id === editingItem.id ? { ...item, url: croppedImage, aspectRatio: editAspectRatio } : item));
      setEditingItem(null);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการครอบตัดรูปภาพ');
    }
  };

  const handleAddQRLine = () => {
    if (items.length >= 6) {
      alert('เพิ่มรูปภาพได้สูงสุด 6 รูปเท่านั้น');
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl('QRLINE.jpg');
    const newItem: MenuItem = {
      id: Math.random().toString(36).substring(7),
      url: publicUrl,
      name: 'QR LINE',
      price: '',
      aspectRatio: '1:1',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleAddPresetMenu = (preset: PresetMenu) => {
    if (items.length >= 6) {
      alert('เพิ่มรูปภาพได้สูงสุด 6 รูปเท่านั้น');
      return;
    }
    const newItem: MenuItem = {
      id: Math.random().toString(36).substring(7),
      url: preset.cropped_url || preset.image_url || PLACEHOLDER_IMG,
      name: preset.name,
      price: preset.price,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleReplaceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replacingItemId) {
      const url = URL.createObjectURL(file);
      const updatedItems = items.map(item => item.id === replacingItemId ? { ...item, url } : item);
      setItems(updatedItems);
      
      // Auto open crop modal
      const itemToEdit = updatedItems.find(item => item.id === replacingItemId);
      if (itemToEdit) {
        setEditingItem(itemToEdit);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setEditAspectRatio(itemToEdit.aspectRatio || '16:9');
      }
    }
    setReplacingItemId(null);
    if (replaceImageRef.current) replaceImageRef.current.value = '';
  };

  const handleSaveToLibrary = async (item: MenuItem) => {
    if (!item.name) {
      alert('กรุณาตั้งชื่อเมนูก่อนบันทึกลงคลัง');
      return;
    }
    try {
      setSavingItemId(item.id);
      
      let imageUrl = null;
      if (item.url && item.url !== PLACEHOLDER_IMG && !item.url.startsWith('http')) {
        // Upload local blob to storage
        const response = await fetch(item.url);
        const blob = await response.blob();
        const fileExt = blob.type.split('/')[1] || 'jpeg';
        const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, blob, { contentType: blob.type });
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      } else if (item.url.startsWith('http')) {
        imageUrl = item.url;
      }
      
      // Insert to database
      const { error: dbError } = await supabase
        .from('preset_menus')
        .insert([{ name: item.name, price: item.price, image_url: imageUrl }]);
        
      if (dbError) throw dbError;
      
      alert('บันทึกเมนูลงคลังประวัติสำเร็จ!');
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาตรวจสอบการตั้งค่า Supabase');
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDelete = (id: string) => {
    setItems((prev) => {
      const itemToDelete = prev.find(item => item.id === id);
      if (itemToDelete) {
        URL.revokeObjectURL(itemToDelete.url);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateItem = (id: string, field: keyof MenuItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleExport = async () => {
    if (!previewRef.current || items.length === 0) return;
    
    try {
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await htmlToImage.toPng(previewRef.current, {
        pixelRatio: 2,
        backgroundColor: '#fdfbf5',
      });
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `menu-${new Date().getTime()}.png`;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf5] flex flex-col md:flex-row font-sans pb-20 md:pb-0">
      {showToolbar && (
        <div
          className="fixed z-[100] bg-white text-gray-800 shadow-xl border border-gray-200 rounded-lg flex items-center p-1 gap-1 -translate-x-1/2"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={() => formatText('bold')} className="p-1.5 hover:bg-gray-100 rounded" title="ตัวหนา">
            <Bold className="w-4 h-4" />
          </button>
          <button onClick={() => formatText('italic')} className="p-1.5 hover:bg-gray-100 rounded" title="ตัวเอียง">
            <Italic className="w-4 h-4" />
          </button>
          <button onClick={() => formatText('underline')} className="p-1.5 hover:bg-gray-100 rounded" title="ขีดเส้นใต้">
            <Underline className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Left Panel - Controls */}
      <div className="w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 p-4 md:p-6 flex flex-col md:h-screen overflow-y-auto shrink-0 z-10 shadow-sm order-1 md:order-1">
        <div className="mb-8 text-center relative">
          <button
            onClick={() => setIsLibraryEditMode(!isLibraryEditMode)}
            className={cn("absolute right-0 top-0 p-2 rounded-xl transition-colors", isLibraryEditMode ? "text-[#f4d068] bg-[#f4d068]/10" : "text-gray-400 hover:bg-gray-100")}
            title={isLibraryEditMode ? "ปิดโหมดแก้ไขคลังเมนู" : "เปิดโหมดแก้ไขคลังเมนู"}
          >
            <Settings className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-[#5c3a21] flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-[#f4d068]" />
            Menu Maker
            <Sparkles className="w-6 h-6 text-[#f4d068]" />
          </h1>
          <p className="text-sm text-gray-500 mt-2">อัปโหลดรูปภาพอาหารและ QR Code (สูงสุด 6 รูป)</p>
        </div>

        <button
          onClick={() => setIsMenuLibraryOpen(true)}
          className="mb-4 w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-[#f4d068]/20 text-[#5c3a21] hover:bg-[#f4d068]/40 transition-colors shadow-sm border-2 border-[#f4d068]/30"
        >
          <BookOpen className="w-5 h-5" />
          เลือกจากคลังเมนูที่เคยทำ
        </button>

        <button
          onClick={handleAddQRLine}
          disabled={items.length >= 6}
          className="mb-4 w-full py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-[#5c3a21] text-white hover:bg-[#4a2e1a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          เพิ่ม QR LINE
        </button>

        <div className="mt-8 flex-1 border-t border-gray-100 pt-6">
          <h2 className="text-sm font-bold text-[#5c3a21] mb-4 tracking-wider flex items-center gap-2">
            รายการรูปภาพ ({items.length}/6)
          </h2>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-3xl border border-dashed border-gray-200">
              ยังไม่มีรูปภาพ
            </div>
          ) : (
            <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
              {items.map((item, index) => (
                <Reorder.Item key={item.id} value={item} className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm group hover:shadow-md transition-shadow relative z-0">
                  <div className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-500" title="ลากเพื่อจัดเรียง">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <div className="relative group/img">
                    <img src={item.url} alt={item.name} className="w-14 h-14 object-cover rounded-xl border border-gray-50" />
                    <button
                      onClick={() => {
                        setReplacingItemId(item.id);
                        replaceImageRef.current?.click();
                      }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl text-white"
                      title="เปลี่ยนรูปภาพ"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{item.name || `รูปที่ ${index + 1}`}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSaveToLibrary(item)}
                      disabled={savingItemId === item.id}
                      className="p-2 text-gray-400 hover:text-[#5c3a21] hover:bg-[#f4d068]/20 rounded-xl transition-colors disabled:opacity-50"
                      title="บันทึกเมนูนี้ลงคลังประวัติ"
                    >
                      {savingItemId === item.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookmarkPlus className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
          <input 
            type="file" 
            ref={replaceImageRef}
            onChange={handleReplaceImage}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

        {/* Layout Controls */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h2 className="text-sm font-bold text-[#5c3a21] mb-3 tracking-wider flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> 
            รูปแบบการจัดวาง
          </h2>
          <div className="flex bg-gray-50 p-1.5 rounded-2xl gap-1">
            <button
              onClick={() => setLayout('grid-1')}
              className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", layout === 'grid-1' ? "bg-white text-[#5c3a21] shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              1 คอลัมน์
            </button>
            <button
              onClick={() => setLayout('grid-2')}
              className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", layout === 'grid-2' ? "bg-white text-[#5c3a21] shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              2 คอลัมน์
            </button>
            <button
              onClick={() => setLayout('grid-3')}
              className={cn("flex-1 py-2 text-sm font-bold rounded-xl transition-all", layout === 'grid-3' ? "bg-white text-[#5c3a21] shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              3 คอลัมน์
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 hidden md:block">
          <button
            onClick={handleExport}
            disabled={items.length === 0 || isExporting}
            className={cn(
              "w-full py-4 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm",
              items.length === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-[#5c3a21] text-white hover:bg-[#4a2e1a] hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
            )}
          >
            <Download className="w-5 h-5" />
            {isExporting ? 'กำลังสร้างรูปภาพ...' : 'ดาวน์โหลดเมนู'}
          </button>
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 p-0 md:p-8 overflow-y-auto flex flex-col items-center bg-gray-100/50 order-2 md:order-2 relative">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 flex flex-col items-center justify-center h-full min-h-[50vh] animate-pulse">
            <ImageIcon className="w-20 h-20 mb-4 opacity-30" />
            <p className="text-xl font-bold">อัปโหลดรูปภาพเพื่อดูตัวอย่างเมนู</p>
          </div>
        ) : (
          <div ref={containerRef} className="w-full flex justify-center items-start py-6 md:py-0 overflow-hidden">
            <div 
              style={{ 
                width: `${800 * scale}px`, 
                height: `${1131 * scale}px`,
              }} 
              className="relative shrink-0 transition-all duration-200 ease-out"
            >
              <div style={{
                width: '800px',
                height: '1131px',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0
              }}>
                {/* A4 Container */}
              <div
                ref={previewRef}
                className="w-full h-full paper-texture shadow-2xl p-6 pb-4 flex flex-col relative overflow-hidden bg-[#fdfbf5]"
              >
              {/* Decorative Blobs */}
              <svg className="absolute top-0 right-0 w-80 h-80 text-[#f4d068] transform translate-x-16 -translate-y-16 opacity-90 pointer-events-none" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M45.7,-76.1C58.9,-69.3,69.1,-55.4,77.5,-41.1C85.9,-26.8,92.5,-12.1,90.4,1.8C88.3,15.7,77.5,28.8,67.5,41.4C57.5,54,48.3,66.1,35.7,73.4C23.1,80.7,7.1,83.2,-7.5,80.3C-22.1,77.4,-35.3,69.1,-48.2,60.1C-61.1,51.1,-73.7,41.4,-80.6,28.3C-87.5,15.2,-88.7,-1.3,-84.1,-15.6C-79.5,-29.9,-69.1,-42,-56.6,-50.2C-44.1,-58.4,-29.5,-62.7,-15.5,-66.9C-1.5,-71.1,11.9,-75.2,25.1,-77.4C38.3,-79.6,51.3,-79.9,45.7,-76.1Z" transform="translate(100 100)" />
              </svg>
              <svg className="absolute bottom-0 left-0 w-96 h-96 text-[#f4d068] transform -translate-x-24 translate-y-24 opacity-90 pointer-events-none" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M41.2,-68.8C53.3,-61.5,63.1,-49.4,71.5,-36.1C79.9,-22.8,86.9,-8.3,85.5,5.6C84.1,19.5,74.3,32.8,63.8,44.5C53.3,56.2,42.1,66.3,28.7,72.8C15.3,79.3,-0.3,82.2,-15.4,79.8C-30.5,77.4,-45.1,69.7,-56.3,58.5C-67.5,47.3,-75.3,32.6,-79.2,17.1C-83.1,1.6,-83.1,-14.7,-77.2,-29.1C-71.3,-43.5,-59.5,-56,-46.1,-63.1C-32.7,-70.2,-17.7,-71.9,-2.1,-68.4C13.5,-64.9,29.1,-56.1,41.2,-68.8Z" transform="translate(100 100)" />
              </svg>

              {/* Corner Badge */}
              <div className="absolute top-8 right-6 z-30 transform rotate-6 transition-transform hover:scale-105">
                <RichTextEdit
                  value={badgeText}
                  onChange={setBadgeText}
                  className="bg-[#ff6b6b] text-white px-5 py-2.5 rounded-3xl font-bold text-xl shadow-lg border-4 border-white outline-none overflow-visible whitespace-nowrap"
                />
              </div>

              {/* Header */}
              <div className="text-center mb-2 shrink-0 relative z-10 flex flex-col items-center">
                <RichTextEdit
                  value={menuTitle}
                  onChange={setMenuTitle}
                  className="text-6xl font-bold title-stroke text-center bg-transparent outline-none w-full mb-1 pb-2 pt-2 leading-[1.2] overflow-visible"
                />
                <RichTextEdit
                  value={menuDate}
                  onChange={setMenuDate}
                  className="text-2xl font-bold text-[#5c3a21] text-center bg-transparent outline-none w-full mb-0 py-1.5 leading-relaxed overflow-visible"
                />
                <RichTextEdit
                  value={menuSubtitle}
                  onChange={setMenuSubtitle}
                  className="text-xl font-bold text-[#5c3a21] text-center bg-transparent outline-none w-full py-1.5 leading-relaxed overflow-visible"
                />
              </div>

              {/* Grid Layout */}
              <div className={cn(
                "flex-1 grid relative z-10 content-start",
                layout === 'grid-1' ? "grid-cols-1 gap-y-4 px-8" : layout === 'grid-3' ? "grid-cols-3 gap-x-4 gap-y-4" : "grid-cols-2 gap-x-6 gap-y-2"
              )}>
                {items.map((item, index) => {
                  const itemAspect = item.aspectRatio || '16:9';
                  return (
                    <div key={item.id} className={cn("flex group", layout === 'grid-1' ? "flex-row items-center gap-6 bg-white/40 p-2 pl-3 rounded-2xl" : "flex-col items-center")}>
                      <div 
                        className={cn(
                          "relative rounded-2xl overflow-hidden shadow-sm border-2 border-transparent group-hover:border-[#f4d068]/50 transition-all cursor-pointer shrink-0",
                          itemAspect === '1:1' 
                            ? (layout === 'grid-1' ? "w-32 aspect-square" : layout === 'grid-3' ? "w-4/5 aspect-square mt-1" : "w-3/4 aspect-square mt-2") 
                            : (layout === 'grid-1' ? "w-48 aspect-[16/9]" : "w-full aspect-[16/9]")
                        )}
                        onClick={() => {
                          if (item.url === PLACEHOLDER_IMG) {
                            setReplacingItemId(item.id);
                            replaceImageRef.current?.click();
                          } else {
                            setEditingItem(item);
                            setCrop({ x: 0, y: 0 });
                            setZoom(1);
                            setEditAspectRatio(itemAspect);
                          }
                        }}
                        title={item.url === PLACEHOLDER_IMG ? "คลิกเพื่ออัปโหลดรูปภาพ" : "คลิกเพื่อแก้ไข/ครอบตัดรูปภาพ"}
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                        {/* Overlay for real images on hover to hint they can click to edit */}
                        {item.url !== PLACEHOLDER_IMG && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <span className="bg-white/90 text-[#5c3a21] text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" /> ครอบตัดรูป
                            </span>
                          </div>
                        )}
                      </div>
                      <div className={cn("flex flex-col w-full px-1", layout === 'grid-1' ? "items-start text-left flex-1" : "items-center mt-1")}>
                        <RichTextEdit
                          value={item.name}
                          onChange={(val) => updateItem(item.id, 'name', val)}
                          placeholder="ชื่อเมนู"
                          className={cn(
                            "font-bold text-[#5c3a21] bg-transparent outline-none w-full hover:bg-white/50 focus:bg-white/80 rounded transition-colors leading-relaxed py-1 overflow-visible empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
                            layout === 'grid-1' ? "text-2xl text-left" : layout === 'grid-3' ? "text-lg text-center" : (itemAspect === '1:1' ? "text-lg mt-1 text-center" : "text-xl text-center")
                          )}
                        />
                        <RichTextEdit
                          value={item.price}
                          onChange={(val) => updateItem(item.id, 'price', val)}
                          placeholder="ราคา"
                          className={cn(
                            "font-bold text-[#5c3a21] bg-transparent outline-none w-full hover:bg-white/50 focus:bg-white/80 rounded transition-colors leading-relaxed py-1 overflow-visible empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
                            layout === 'grid-1' ? "text-xl text-left" : layout === 'grid-3' ? "text-base text-center" : "text-lg text-center"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Floating QR Code Removed */}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Mobile Sticky Download Button */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
        <button
          onClick={handleExport}
          disabled={items.length === 0 || isExporting}
          className={cn(
            "w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm text-lg",
            items.length === 0
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-[#5c3a21] text-white hover:bg-[#4a2e1a] active:scale-[0.98]"
          )}
        >
          <Download className="w-5 h-5" />
          {isExporting ? 'กำลังสร้างรูปภาพ...' : 'ดาวน์โหลดเมนู'}
        </button>
      </div>

      {/* Crop Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-[#5c3a21]">แก้ไขรูปภาพ</h3>
                <button
                  onClick={() => {
                    setReplacingItemId(editingItem.id);
                    replaceImageRef.current?.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f4d068]/20 text-[#5c3a21] rounded-lg text-sm font-bold hover:bg-[#f4d068]/40 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  เปลี่ยนรูปใหม่
                </button>
              </div>
              <button onClick={() => setEditingItem(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative w-full h-[50vh] bg-gray-900">
              <Cropper
                image={editingItem.url}
                crop={crop}
                zoom={zoom}
                aspect={editAspectRatio === '1:1' ? 1 : 16/9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-4 flex flex-col gap-4 bg-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-600 shrink-0">สัดส่วน:</span>
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => setEditAspectRatio('16:9')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                        editAspectRatio === '16:9' ? "bg-white text-[#5c3a21] shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      16:9
                    </button>
                    <button
                      onClick={() => setEditAspectRatio('1:1')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                        editAspectRatio === '1:1' ? "bg-white text-[#5c3a21] shadow-sm" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      1:1
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <span className="text-sm font-bold text-gray-600 shrink-0">ซูม:</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-[#f4d068]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-6 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveCrop}
                  className="px-6 py-2 rounded-xl font-bold text-white bg-[#5c3a21] hover:bg-[#4a2e1a] flex items-center gap-2 transition-colors"
                >
                  <Check className="w-5 h-5" />
                  บันทึกรูปภาพ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MenuLibrary 
        isOpen={isMenuLibraryOpen} 
        onClose={() => setIsMenuLibraryOpen(false)} 
        onSelect={handleAddPresetMenu} 
        isEditMode={isLibraryEditMode}
      />
    </div>
  );
}

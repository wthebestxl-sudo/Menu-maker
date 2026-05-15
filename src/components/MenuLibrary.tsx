import React, { useState, useEffect, useCallback } from 'react';
import { PresetMenu } from '../data/presetMenus';
import { X, Search, Plus, BookOpen, Loader2, ImagePlus, Check, Pencil, Upload, Crop, CloudUpload, Eye } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/cropImage';

interface MenuLibraryProps {
  onSelect: (menu: PresetMenu) => void;
  onClose: () => void;
  isOpen: boolean;
  isEditMode?: boolean;
}

export function MenuLibrary({ onSelect, onClose, isOpen, isEditMode = true }: MenuLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [menus, setMenus] = useState<PresetMenu[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add new menu state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('70$');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit image state
  const editImageRef = React.useRef<HTMLInputElement>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [isUpdatingImage, setIsUpdatingImage] = useState<string | null>(null);

  // Quick upload state
  const quickUploadRef = React.useRef<HTMLInputElement>(null);
  const [isQuickUploading, setIsQuickUploading] = useState(false);

  // Preview / Crop state
  const [cropMenu, setCropMenu] = useState<PresetMenu | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Pending crops (local, not yet synced)
  const [pendingCrops, setPendingCrops] = useState<Record<string, string>>({});
  const [pendingTexts, setPendingTexts] = useState<Record<string, { name: string, price: string }>>({});
  const [isSyncingCrops, setIsSyncingCrops] = useState(false);
  const [isSyncingTexts, setIsSyncingTexts] = useState(false);

  // Edit text state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchMenus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else if (cropMenu) {
          setCropMenu(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, cropMenu, isOpen, onClose]);

  const fetchMenus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('preset_menus')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching from Supabase:', error);
        setMenus([]); 
      } else if (data) {
        setMenus(data as PresetMenu[]);
      } else {
        setMenus([]);
      }
    } catch (e) {
      console.error(e);
      setMenus([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewMenu = async () => {
    if (!newName.trim() || !newPrice.trim()) return;
    setIsSaving(true);
    try {
      let imageUrl = null;
      if (newImage) {
        const fileExt = newImage.type.split('/')[1] || 'jpeg';
        const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, newImage, { contentType: newImage.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('preset_menus')
        .insert([{ name: newName, price: newPrice, image_url: imageUrl }]);
      if (error) throw error;
      
      setIsAdding(false);
      setNewName('');
      setNewPrice('70$');
      setNewImage(null);
      fetchMenus();
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการสร้างเมนูใหม่: ' + (e?.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingMenuId) return;
    setIsUpdatingImage(editingMenuId);
    
    try {
      const fileExt = file.type.split('/')[1] || 'jpeg';
      const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      
      const { error: dbError } = await supabase
        .from('preset_menus')
        .update({ image_url: publicUrl })
        .eq('id', editingMenuId);
        
      if (dbError) throw dbError;
      
      setMenus(menus.map(m => m.id === editingMenuId ? { ...m, image_url: publicUrl } : m));
    } catch (err: any) {
      console.error(err);
      alert('อัปเดตรูปภาพล้มเหลว: ' + (err?.message || ''));
    } finally {
      setIsUpdatingImage(null);
      setEditingMenuId(null);
      if (editImageRef.current) editImageRef.current.value = '';
    }
  };

  const startEditingText = (menu: PresetMenu) => {
    setEditingTextId(menu.id);
    setEditName(menu.name);
    setEditPrice(menu.price);
  };

  const cancelEditingText = () => {
    setEditingTextId(null);
    setEditName('');
    setEditPrice('');
  };

  const handleSaveText = (menuId: string) => {
    if (!editName.trim() || !editPrice.trim()) return;
    
    // Save locally (pending)
    setPendingTexts(prev => ({ ...prev, [menuId]: { name: editName, price: editPrice } }));
    
    // Update local display immediately
    setMenus(menus.map(m => m.id === menuId ? { ...m, name: editName, price: editPrice } : m));
    setEditingTextId(null);
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsQuickUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.type.split('/')[1] || 'jpeg';
        const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}_${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
        
        const { error: dbError } = await supabase
          .from('preset_menus')
          .insert([{ name: 'name', price: '70$', image_url: publicUrl }]);
        if (dbError) throw dbError;
      }
      
      fetchMenus();
    } catch (err: any) {
      console.error(err);
      alert('อัปโหลดล้มเหลว: ' + (err?.message || ''));
    } finally {
      setIsQuickUploading(false);
      if (quickUploadRef.current) quickUploadRef.current.value = '';
    }
  };

  const onCropComplete = useCallback((_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropSave = () => {
    if (!cropMenu || !cropMenu.image_url || !croppedAreaPixels) return;
    
    // Close modal IMMEDIATELY for snappy UX
    const menuId = cropMenu.id;
    const imageUrl = cropMenu.image_url;
    const cropPixels = { ...croppedAreaPixels };
    
    setCropMenu(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    
    // Mark as pending right away
    setPendingCrops(prev => ({ ...prev, [menuId]: 'processing' }));
    
    // Process crop in background
    setTimeout(async () => {
      try {
        const croppedBlobUrl = await getCroppedImg(imageUrl, cropPixels);
        setPendingCrops(prev => ({ ...prev, [menuId]: croppedBlobUrl }));
      } catch (err) {
        console.error(err);
        setPendingCrops(prev => {
          const next = { ...prev };
          delete next[menuId];
          return next;
        });
      }
    }, 50);
  };

  const handleSyncCrops = async () => {
    const entries = Object.entries(pendingCrops).filter(([, v]) => v !== 'processing');
    if (entries.length === 0) return;
    setIsSyncingCrops(true);
    
    try {
      for (const [menuId, blobUrl] of entries) {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        
        const fileName = `cropped_${Math.random().toString(36).substring(7)}_${Date.now()}.jpeg`;
        const { error: uploadError } = await supabase.storage
          .from('menu-images')
          .upload(fileName, blob, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
        
        const { error: dbError } = await supabase
          .from('preset_menus')
          .update({ cropped_url: publicUrl })
          .eq('id', menuId);
        if (dbError) throw dbError;
        
        setMenus(prev => prev.map(m => m.id === menuId ? { ...m, cropped_url: publicUrl } : m));
        URL.revokeObjectURL(blobUrl);
      }
      
      setPendingCrops({});
    } catch (err: any) {
      console.error(err);
      alert('ซิงค์รูปล้มเหลว: ' + (err?.message || ''));
    } finally {
      setIsSyncingCrops(false);
    }
  };

  const handleSyncTexts = async () => {
    const entries = Object.entries(pendingTexts);
    if (entries.length === 0) return;
    setIsSyncingTexts(true);
    
    try {
      for (const [menuId, { name, price }] of entries) {
        const { error } = await supabase
          .from('preset_menus')
          .update({ name, price })
          .eq('id', menuId);
        if (error) throw error;
      }
      
      setPendingTexts({});
    } catch (err: any) {
      console.error(err);
      alert('ซิงค์ชื่อล้มเหลว: ' + (err?.message || ''));
    } finally {
      setIsSyncingTexts(false);
    }
  };

  if (!isOpen) return null;

  const filteredMenus = menus.filter(menu => 
    menu.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-[#fdfbf5] rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden border-4 border-white">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3 text-[#5c3a21]">
            <div className="p-2 bg-[#f4d068]/20 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">คลังเมนูประวัติ</h3>
          </div>
          <div className="flex items-center gap-2">
            {Object.keys(pendingCrops).length > 0 && (
              <button 
                onClick={handleSyncCrops}
                disabled={isSyncingCrops}
                className="px-3 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center gap-1.5 disabled:opacity-60 animate-pulse hover:animate-none text-xs"
              >
                {isSyncingCrops ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crop className="w-3.5 h-3.5" />}
                ซิงค์รูป ({Object.keys(pendingCrops).length})
              </button>
            )}
            {Object.keys(pendingTexts).length > 0 && (
              <button 
                onClick={handleSyncTexts}
                disabled={isSyncingTexts}
                className="px-3 py-2 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors flex items-center gap-1.5 disabled:opacity-60 animate-pulse hover:animate-none text-xs"
              >
                {isSyncingTexts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                ซิงค์ชื่อ ({Object.keys(pendingTexts).length})
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 bg-white border-b border-gray-100 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเมนู..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#f4d068] focus:border-transparent transition-all"
            />
          </div>
          {isEditMode && (
            <>
              <button 
                onClick={() => {
                  quickUploadRef.current?.click();
                }}
                disabled={isQuickUploading}
                className="px-4 bg-[#5c3a21] text-white font-bold rounded-xl hover:bg-[#4a2e1a] transition-colors flex items-center gap-2 disabled:opacity-60 shrink-0"
                title="เลือกรูปภาพเพื่อเพิ่มเมนูใหม่อัตโนมัติ (ชื่อ: name, ราคา: 70$)"
              >
                {isQuickUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                อัปรูป
              </button>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="px-4 bg-[#f4d068] text-[#5c3a21] font-bold rounded-xl hover:bg-[#e3c15f] transition-colors flex items-center gap-2 shrink-0"
              >
                <Plus className="w-5 h-5" />
                เพิ่มเมนู
              </button>
            </>
          )}
          <input 
            type="file" 
            ref={quickUploadRef}
            onChange={handleQuickUpload}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
          />
        </div>

        {/* Add Form */}
        {isAdding && (
          <div className="p-4 bg-[#fffdf6] border-b border-gray-100 flex flex-col gap-3">
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="ชื่อเมนู" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-[#f4d068]" 
              />
              <input 
                type="text" 
                placeholder="ราคา (เช่น 70$)" 
                value={newPrice} 
                onChange={e => setNewPrice(e.target.value)} 
                className="w-24 px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-[#f4d068]" 
              />
            </div>
            <div className="flex gap-3 items-center">
              <input 
                type="file" 
                onChange={e => setNewImage(e.target.files?.[0] || null)} 
                className="text-sm flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#f4d068]/20 file:text-[#5c3a21] hover:file:bg-[#f4d068]/30 cursor-pointer" 
                accept="image/*" 
              />
              <button 
                onClick={handleAddNewMenu}
                disabled={isSaving || !newName.trim()}
                className="px-6 py-2 bg-[#5c3a21] text-white font-bold rounded-lg hover:bg-[#4a2e1a] disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                บันทึก
              </button>
            </div>
          </div>
        )}
        
        {/* Grid List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2 h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#f4d068]" />
              <p>กำลังโหลดข้อมูลจากคลัง...</p>
            </div>
          ) : menus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3 h-full">
              <BookOpen className="w-12 h-12 text-gray-300" />
              <p>คลังเมนูว่างเปล่า</p>
              <p className="text-sm">ลองกด "+ เพิ่มเมนู" เพื่อสร้างเมนูแรกของคุณสิ!</p>
            </div>
          ) : filteredMenus.length === 0 ? (
            <div className="text-center py-20 text-gray-400 h-full">
              ไม่พบชื่อเมนูที่ค้นหา
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4">
              {filteredMenus.map(menu => (
                <div 
                  key={menu.id}
                  className="flex flex-col bg-white rounded-2xl border-2 border-transparent shadow-sm hover:border-[#f4d068] hover:shadow-xl transition-all group overflow-hidden relative"
                  onClick={() => {
                    if (!isEditMode) {
                      const menuWithCrop = pendingCrops[menu.id] 
                        ? { ...menu, cropped_url: pendingCrops[menu.id] }
                        : menu;
                      onSelect(menuWithCrop);
                      onClose();
                    }
                  }}
                  style={{ cursor: !isEditMode ? 'pointer' : 'default' }}
                >
                  <div className="aspect-square bg-gray-50 relative flex items-center justify-center">
                    {menu.image_url ? (
                      <img src={menu.image_url} alt={menu.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl opacity-30">🍲</span>
                    )}
                    {pendingCrops[menu.id] ? (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow flex items-center gap-1 animate-pulse">
                        <Crop className="w-3 h-3" /> รอซิงค์
                      </div>
                    ) : menu.cropped_url ? (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow flex items-center gap-1">
                        <Crop className="w-3 h-3" /> ครอบแล้ว
                      </div>
                    ) : null}
                    {isEditMode && pendingTexts[menu.id] && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow flex items-center gap-1 animate-pulse">
                        <Pencil className="w-3 h-3" /> แก้แล้ว
                      </div>
                    )}
                    
                    {/* Hover Actions */}
                    {isEditMode && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (menu.image_url) {
                              setCropMenu(menu);
                              setCrop({ x: 0, y: 0 });
                              setZoom(1);
                            }
                          }}
                          className="w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-colors backdrop-blur-md shadow-lg"
                          title="ครอบตัดรูป"
                        >
                          <Crop className="w-6 h-6" />
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(menu.image_url);
                          }}
                          className="w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-colors backdrop-blur-md shadow-lg"
                          title="ดูรูปภาพเต็ม"
                        >
                          <Eye className="w-6 h-6" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          // Pass the pending local crop or synced crop or original
                          const menuWithCrop = pendingCrops[menu.id] 
                            ? { ...menu, cropped_url: pendingCrops[menu.id] }
                            : menu;
                          onSelect(menuWithCrop);
                          onClose();
                        }}
                        className="px-5 py-2.5 bg-[#f4d068] text-[#5c3a21] font-bold rounded-xl hover:bg-[#e3c15f] transition-all flex items-center gap-2 shadow-lg transform hover:scale-105"
                      >
                        <Plus className="w-5 h-5" /> เลือกใช้
                      </button>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditingText(menu)}
                          className="px-3 py-2 bg-white/95 text-gray-700 font-bold rounded-xl hover:bg-white transition-all flex items-center gap-1 shadow-lg transform hover:scale-105 text-xs"
                        >
                          <Pencil className="w-4 h-4" /> แก้ไขชื่อ
                        </button>
                        
                        <button
                          onClick={() => {
                            setEditingMenuId(menu.id);
                            editImageRef.current?.click();
                          }}
                          disabled={isUpdatingImage === menu.id}
                          className="px-3 py-2 bg-white/95 text-gray-700 font-bold rounded-xl hover:bg-white transition-all flex items-center gap-1 shadow-lg transform hover:scale-105 text-xs"
                        >
                          {isUpdatingImage === menu.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                          เปลี่ยนรูป
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                  
                  <div className="p-3 text-center bg-white z-10 border-t border-gray-50 flex flex-col items-center justify-center min-h-[5rem]">
                    {isEditMode && editingTextId === menu.id ? (
                      <div className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText(menu.id); }}
                          className="w-full text-center font-bold text-[#5c3a21] text-sm border-b-2 border-[#f4d068] focus:outline-none bg-yellow-50/50 py-0.5 rounded-sm"
                          placeholder="ชื่อเมนู"
                          autoFocus
                        />
                        <div className="flex gap-1 mt-1 justify-center items-center">
                          <input
                            type="text"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveText(menu.id); }}
                            className="w-14 text-center font-bold text-gray-500 text-xs border-b-2 border-gray-300 focus:outline-none focus:border-[#f4d068] py-0.5 rounded-sm"
                            placeholder="ราคา"
                          />
                        <div className="flex gap-1 ml-1">
                            <button 
                              onClick={() => handleSaveText(menu.id)}
                              className="p-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                              title="บันทึก"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={cancelEditingText}
                              className="p-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                              title="ยกเลิก"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-bold text-[#5c3a21] text-sm line-clamp-2 leading-tight" title={menu.name}>{menu.name}</h4>
                        <p className="text-sm font-bold text-gray-400 mt-1">{menu.price}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <input 
            type="file" 
            ref={editImageRef}
            onChange={handleUpdateImage}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

      </div>

      {/* Crop Modal */}
      {cropMenu && cropMenu.image_url && (
        <div 
          className="fixed inset-0 z-[60] flex flex-col bg-black/95 backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
          {/* Crop Header */}
          <div className="flex items-center justify-between p-4 bg-black/50 z-10">
            <div className="flex items-center gap-3">
              <Crop className="w-5 h-5 text-[#f4d068]" />
              <h3 className="text-white font-bold text-lg">ครอบตัดรูป: {cropMenu.name}</h3>
            </div>
            <button 
              onClick={() => { setCropMenu(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
              className="text-white/70 hover:text-white p-2 transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
          </div>
          
          {/* Crop Area */}
          <div className="flex-1 relative">
            <Cropper
              image={cropMenu.image_url}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          
          {/* Crop Footer */}
          <div className="p-4 bg-black/50 flex flex-col gap-3 items-center z-10">
            <div className="flex items-center gap-3 w-full max-w-md">
              <span className="text-white/70 text-sm whitespace-nowrap">ซูม</span>
              <input 
                type="range" 
                min={1} 
                max={3} 
                step={0.1} 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#f4d068] h-2 cursor-pointer"
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => { setCropMenu(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleCropSave}
                className="px-8 py-3 bg-[#f4d068] text-[#5c3a21] font-bold rounded-xl hover:bg-[#e3c15f] transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(244,208,104,0.3)]"
              >
                <Check className="w-5 h-5" />
                บันทึกรูปที่ครอบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-4 right-4 p-3 bg-white/10 text-white hover:bg-white/20 rounded-full transition-colors z-[80]"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

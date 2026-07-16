import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { Image as ImageIcon, Check, Download, ChevronLeft, LayoutGrid } from 'lucide-react';

interface Wallpaper {
  id: string;
  url: string;
  category: string;
}

const wallpapers: Wallpaper[] = [
  // Imam Ali (as)
  { id: 'ali_1', url: 'https://i.postimg.cc/3R3sxzjV/cbb05bca698646df6338294252dc85e5.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_2', url: 'https://i.postimg.cc/fTSrDwnc/621ad5d0bf73f0b7c315eac17a1a38d3.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_3', url: 'https://i.postimg.cc/qvTVFthR/25a81109e497b5146d2f75526efc3f86.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_4', url: 'https://i.postimg.cc/x1Cyn5bP/4a59001919bb08d83f29e9c6cdaa49e9.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_5', url: 'https://i.ibb.co/600bRV1b/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_6', url: 'https://i.ibb.co/gC6fXW9/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_7', url: 'https://i.ibb.co/xKNNJ2Gy/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_8', url: 'https://i.ibb.co/Q7BMgqH9/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_9', url: 'https://i.ibb.co/xtBFm13r/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_10', url: 'https://i.ibb.co/4R9Mvh8S/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_11', url: 'https://i.ibb.co/4Zq1SNyV/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_12', url: 'https://i.ibb.co/CZv4Zvx/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_13', url: 'https://i.ibb.co/jvJtqrkZ/x.jpg', category: 'الإمام علي (عليه السلام)' },
  { id: 'ali_14', url: 'https://i.ibb.co/qF03CL4J/x.jpg', category: 'الإمام علي (عليه السلام)' },
  
  // Imam Hussain (as)
  { id: 'hussain_1', url: 'https://i.postimg.cc/GhvxX9nT/350edc697f03d92ddc4611ac1a9fa370.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_2', url: 'https://i.postimg.cc/1zX6132j/ec49249f6978162028dd5d1753744ba9.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_3', url: 'https://i.postimg.cc/527YgMyw/15456a1363472cb96accda907abcca83.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_4', url: 'https://i.postimg.cc/prRLx0yj/6bccb35b96de67caab0eb90f33b06f52.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_5', url: 'https://i.postimg.cc/xj50M3cz/82500f9fd7852fb8e438619d6bd59a9c.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_6', url: 'https://i.postimg.cc/7ZVcQKrW/29263687b909687f2c2e9bc1ea6c1a54.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_7', url: 'https://i.postimg.cc/bvnnwBYD/Picsart-26-05-13-11-33-18-823.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_8', url: 'https://i.ibb.co/VWszCzPP/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_9', url: 'https://i.ibb.co/Kxwcw10s/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_10', url: 'https://i.ibb.co/XkSWTHjm/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_11', url: 'https://i.ibb.co/LyJckY6/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_12', url: 'https://i.ibb.co/Xf5rLSk2/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_13', url: 'https://i.ibb.co/SwYh5rmL/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_14', url: 'https://i.ibb.co/YBc2LSDw/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_15', url: 'https://i.ibb.co/mrD0yy7q/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_16', url: 'https://i.ibb.co/svy9Vgjw/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_17', url: 'https://i.ibb.co/YTwbPvhT/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_18', url: 'https://i.ibb.co/MxqxjkSg/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_19', url: 'https://i.ibb.co/7xXJMmbJ/x.jpg', category: 'الإمام الحسين (عليه السلام)' },
  { id: 'hussain_20', url: 'https://i.ibb.co/S71ZwQQ1/x.jpg', category: 'الإمام الحسين (عليه السلام)' },

  // Imam Abbas (as)
  { id: 'abbas_1', url: 'https://i.postimg.cc/Ss0gHgWy/1591527186-6274.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_2', url: 'https://i.postimg.cc/x18Yd1hW/b0399e90aa31ef2dc13281f457a47fb8.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_3', url: 'https://i.postimg.cc/SRmbbSWx/Picsart-26-05-13-08-25-33-105.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_4', url: 'https://i.postimg.cc/J46VSW0F/Picsart-26-05-13-08-26-19-833.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_5', url: 'https://i.postimg.cc/Cx9yLHjz/Picsart-26-05-13-08-27-19-694.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_6', url: 'https://i.postimg.cc/63QGLm6v/Picsart-26-05-13-11-38-25-619.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_7', url: 'https://i.ibb.co/NgV4Jckw/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_8', url: 'https://i.ibb.co/0jDKYc6S/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_9', url: 'https://i.ibb.co/WvfV2WMP/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_10', url: 'https://i.ibb.co/nMTkpbkY/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_11', url: 'https://i.ibb.co/8n9HbzVn/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_12', url: 'https://i.ibb.co/v62VLyMY/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_13', url: 'https://i.ibb.co/q3cF3fqq/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_14', url: 'https://i.ibb.co/WpNcB7YW/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_15', url: 'https://i.ibb.co/dwpZ5wmM/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_16', url: 'https://i.ibb.co/cK3jqx0Y/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_17', url: 'https://i.ibb.co/zV6By5DJ/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_18', url: 'https://i.ibb.co/PzgfGZPm/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_19', url: 'https://i.ibb.co/Lh2DBT0L/x.jpg', category: 'الإمام العباس (عليه السلام)' },
  { id: 'abbas_20', url: 'https://i.ibb.co/rfQsnK0v/x.jpg', category: 'الإمام العباس (عليه السلام)' },

  // Imam Reza (as)
  { id: 'reza_1', url: 'https://i.postimg.cc/R01085Vp/167aaab3790a758ba9d1507cc635ccb4.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_2', url: 'https://i.postimg.cc/B6QJVjz8/f2aed24a6e34f77d845cad8dee12de9d.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_3', url: 'https://i.postimg.cc/cHbGkXwG/80ce27b7c9d7da39af3df9138a61f467.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_4', url: 'https://i.postimg.cc/5ttxPHTg/Picsart-26-05-13-11-35-36-978.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_5', url: 'https://i.ibb.co/8nwBMXfH/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_6', url: 'https://i.ibb.co/8DNHPQ9h/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_7', url: 'https://i.ibb.co/SX35MqsW/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_8', url: 'https://i.ibb.co/7JCRp5y0/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_9', url: 'https://i.ibb.co/QG13Mj1/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_10', url: 'https://i.ibb.co/pBrMzWCC/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_11', url: 'https://i.ibb.co/HpbWq1nd/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_12', url: 'https://i.ibb.co/wF68dXvJ/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_13', url: 'https://i.ibb.co/RpSmgt8z/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_14', url: 'https://i.ibb.co/zhmqKhs8/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_15', url: 'https://i.ibb.co/WN05NVJc/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_16', url: 'https://i.ibb.co/JRbvfTbB/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_17', url: 'https://i.ibb.co/fz47cjRj/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_18', url: 'https://i.ibb.co/6J1NBqJb/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_19', url: 'https://i.ibb.co/JR5qc4mK/x.jpg', category: 'الإمام الرضا (عليه السلام)' },
  { id: 'reza_20', url: 'https://i.ibb.co/s9JLzsY6/x.jpg', category: 'الإمام الرضا (عليه السلام)' },

  // Sayyida Zaynab (as)
  { id: 'zaynab_1', url: 'https://i.ibb.co/cStC2jvd/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_2', url: 'https://i.ibb.co/B2bcyJCx/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_3', url: 'https://i.ibb.co/chDB7pK5/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_4', url: 'https://i.ibb.co/zWf4YH3D/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_5', url: 'https://i.ibb.co/1fqB6XWj/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_6', url: 'https://i.ibb.co/0y0HK088/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_7', url: 'https://i.ibb.co/zW2jv1V0/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_8', url: 'https://i.ibb.co/B5Twn2qB/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_9', url: 'https://i.ibb.co/7tbLvtDr/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_10', url: 'https://i.ibb.co/G35w5ZDq/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_11', url: 'https://i.ibb.co/wNZfw44w/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_12', url: 'https://i.ibb.co/fVqRQbHc/x.jpg', category: 'السيدة زينب عليها السلام' },
  { id: 'zaynab_13', url: 'https://i.ibb.co/4RNx94Bw/x.jpg', category: 'السيدة زينب عليها السلام' },

  // Imamain Al-Jawadain (as)
  { id: 'jawadain_1', url: 'https://i.ibb.co/5bPnKQK/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_2', url: 'https://i.ibb.co/Z62mBKW0/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_3', url: 'https://i.ibb.co/1Gp402WT/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_4', url: 'https://i.ibb.co/JwPX3WGk/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_5', url: 'https://i.ibb.co/gMPtwkmG/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_6', url: 'https://i.ibb.co/SXPvPFLJ/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_7', url: 'https://i.ibb.co/ynWCrdQj/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_8', url: 'https://i.ibb.co/rRGDJQtG/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_9', url: 'https://i.ibb.co/mF5NNhdd/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_10', url: 'https://i.ibb.co/0yNZ4388/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_11', url: 'https://i.ibb.co/B2QNkX61/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_12', url: 'https://i.ibb.co/QFVQSr1Y/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_13', url: 'https://i.ibb.co/spqQFrfV/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_14', url: 'https://i.ibb.co/hxYg6mD2/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_15', url: 'https://i.ibb.co/mVzk7vdT/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_16', url: 'https://i.ibb.co/nqjNhWTf/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_17', url: 'https://i.ibb.co/1t4GC6ph/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_18', url: 'https://i.ibb.co/HfcPNsP1/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_19', url: 'https://i.ibb.co/d0MHXrQ6/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
  { id: 'jawadain_20', url: 'https://i.ibb.co/n8ZsCH8L/x.jpg', category: 'الإمامين الجوادين (عليهما السلام)' },
];

const PhotoGallery: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [selectedImage, setSelectedImage] = React.useState<Wallpaper | null>(null);
  const isAr = settings.language === 'ar';

  const categories = Array.from(new Set(wallpapers.map(w => w.category)));

  const handleSetWallpaper = (url: string | undefined) => {
    updateSettings({ backgroundImage: url });
    if (url) {
      if (isAr) {
        alert('تم تعيين الخلفية بنجاح ✅');
      } else {
        alert('Background set successfully ✅');
      }
    } else {
      if (isAr) {
        alert('تم إلغاء تعيين الخلفية ✅');
      } else {
        alert('Background removed successfully ✅');
      }
    }
  };

  const downloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `wallpaper_${id}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-lg mx-auto flex flex-col gap-8 pb-32">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-black text-natural-dark dark:text-white font-serif-header tracking-tight">
          {isAr ? 'معرض الصور' : 'Photo Gallery'}
        </h1>
        <p className="text-natural-dark/50 dark:text-white/40 text-[11px] font-black uppercase tracking-[0.2em]">
          {isAr ? 'خلفيات إسلامية روحانية بجودة عالية' : 'High Quality Islamic Wallpapers'}
        </p>
        <div className="w-12 h-1 bg-natural-accent dark:bg-dark-accent rounded-full" />
      </header>

      {categories.map((category) => (
        <section key={category} className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <LayoutGrid size={16} className="text-natural-accent dark:text-dark-accent" />
            <h2 className="text-lg font-black text-natural-dark dark:text-white tracking-tight">{category}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {wallpapers.filter(w => w.category === category).map((bg) => (
              <motion.div
                key={bg.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedImage(bg)}
                className={`relative h-48 rounded-[32px] overflow-hidden border-2 transition-all cursor-pointer group ${
                  settings.backgroundImage === bg.url 
                    ? 'border-natural-accent dark:border-dark-accent shadow-lg' 
                    : 'border-white/20 dark:border-white/5'
                }`}
              >
                <img 
                  src={bg.url} 
                  alt={bg.id} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                
                {settings.backgroundImage === bg.url && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-natural-accent dark:bg-dark-accent rounded-full flex items-center justify-center shadow-lg">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      ))}

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 dark:bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-10 right-10 w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-natural-dark dark:text-white hover:bg-black/10 dark:hover:bg-white/20 transition-all active:scale-90"
            >
              <ChevronLeft size={24} className="rotate-180" />
            </button>

            <motion.div
              layoutId={selectedImage.id}
              className="w-full max-w-md aspect-[9/16] rounded-[40px] overflow-hidden shadow-2xl border border-white/10 mb-8"
            >
              <img 
                src={selectedImage.url} 
                alt="Preview" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            <div className="flex gap-4 w-full max-w-md">
              {settings.backgroundImage === selectedImage.url ? (
                <button
                  onClick={() => handleSetWallpaper(undefined)}
                  className="flex-1 h-14 rounded-2xl bg-white/10 border border-white/10 text-white dark:text-white/60 font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all hover:bg-white/20"
                >
                  <Check size={18} className="text-white/40" />
                  {isAr ? 'إلغاء تعيين الخلفية' : 'Remove Wallpaper'}
                </button>
              ) : (
                <button
                  onClick={() => handleSetWallpaper(selectedImage.url)}
                  className="flex-1 h-14 rounded-2xl bg-natural-accent dark:bg-dark-accent text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                  <ImageIcon size={18} />
                  {isAr ? 'تعيين كخلفية' : 'Set as Wallpaper'}
                </button>
              )}
              
              <button
                onClick={() => downloadImage(selectedImage.url, selectedImage.id)}
                className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
              >
                <Download size={20} />
              </button>
            </div>
            
            <p className="mt-6 text-white/40 text-[10px] font-black uppercase tracking-widest">{selectedImage.category}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoGallery;

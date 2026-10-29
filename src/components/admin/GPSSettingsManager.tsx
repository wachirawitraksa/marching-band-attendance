import { useState, useEffect } from 'react';
import { MapPin, Save, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

interface GPSSetting {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
}

export function GPSSettingsManager() {
  const { profile } = useAuthStore();
  const [settings, setSettings] = useState<GPSSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Omit<GPSSetting, 'id'>>({
    name: 'ห้องดนตรี',
    latitude: 18.7784475,
    longitude: 100.780098,
    allowed_radius: 200,
  });

  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('gps_settings')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
        setFormData({
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          allowed_radius: data.allowed_radius,
        });
      }
    } catch (err) {
      console.error('Failed to load GPS settings:', err);
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดตั้งค่า GPS',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isTeacher) {
      toast({
        variant: 'destructive',
        title: 'สิทธิ์ไม่เพียงพอ',
        description: 'เฉพาะครูอาจารย์เท่านั้นที่สามารถแก้ไขได้',
      });
      return;
    }

    setSaving(true);
    try {
      if (settings) {
        // Update existing
        const { error } = await supabase
          .from('gps_settings')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase.from('gps_settings').insert({
          ...formData,
          is_active: true,
        });

        if (error) throw error;
      }

      toast({
        variant: 'success',
        title: 'บันทึกสำเร็จ',
        description: 'ตั้งค่า GPS ได้รับการอัปเดต',
      });

      await loadSettings();
    } catch (err) {
      console.error('Error saving GPS settings:', err);
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: err instanceof Error ? err.message : 'ไม่สามารถบันทึกตั้งค่า',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'ไม่รองรับ GPS',
        description: 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง',
      });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        toast({
          variant: 'success',
          title: 'ได้ตำแหน่งแล้ว',
          description: `ละติจูด: ${position.coords.latitude.toFixed(6)}, ลองจิจูด: ${position.coords.longitude.toFixed(6)}`,
        });
        setLoading(false);
      },
      (error) => {
        toast({
          variant: 'destructive',
          title: 'ไม่สามารถรับตำแหน่ง',
          description: error.message,
        });
        setLoading(false);
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin size={18} className="text-brand-400" />
          ตั้งค่าพื้นที่เช็คชื่อ GPS
        </CardTitle>
        <CardDescription>
          กำหนดพิกัดและรัศมีการอนุญาตสำหรับการเช็คชื่อ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isTeacher && (
          <Alert variant="destructive">
            <AlertCircle size={16} />
            <AlertDescription>
              เฉพาะครูอาจารย์เท่านั้นที่สามารถแก้ไขตั้งค่า GPS ได้
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="gpssettings-manager-1" className="text-xs font-medium">ชื่อพื้นที่</Label>
            <Input id="gpssettings-manager-1"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={loading || !isTeacher}
              placeholder="เช่น ห้องดนตรี"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="gpssettings-manager-2" className="text-xs font-medium">ละติจูด</Label>
              <Input id="gpssettings-manager-2"
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    latitude: parseFloat(e.target.value),
                  }))
                }
                disabled={loading || !isTeacher}
                placeholder="18.7784475"
              />
            </div>
            <div>
              <Label htmlFor="gpssettings-manager-3" className="text-xs font-medium">ลองจิจูด</Label>
              <Input id="gpssettings-manager-3"
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    longitude: parseFloat(e.target.value),
                  }))
                }
                disabled={loading || !isTeacher}
                placeholder="100.780098"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="gpssettings-manager-4" className="text-xs font-medium">รัศมีการอนุญาต (เมตร)</Label>
            <Input id="gpssettings-manager-4"
              type="number"
              min="10"
              max="1000"
              step="10"
              value={formData.allowed_radius}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  allowed_radius: parseInt(e.target.value, 10),
                }))
              }
              disabled={loading || !isTeacher}
            />
            <p className="text-xs text-muted-foreground mt-1">
              นักเรียนสามารถเช็คชื่อได้ภายใน {formData.allowed_radius} เมตรจากจุดที่กำหนด
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleGetCurrentLocation}
              disabled={loading || !isTeacher}
              className="flex-1 gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  กำลังรับตำแหน่ง...
                </>
              ) : (
                <>
                  <MapPin size={14} />
                  ใช้ตำแหน่งปัจจุบัน
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !isTeacher}
              className="flex-1 gap-1.5 bg-brand-500 hover:bg-brand-600"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save size={14} />
                  บันทึก
                </>
              )}
            </Button>
          </div>
        </div>

        {settings && (
          <Alert className="bg-brand-500/10 border-brand-500/30">
            <MapPin size={16} className="text-brand-400" />
            <AlertDescription className="text-sm">
              ตั้งค่าปัจจุบัน: <span className="font-medium">{settings.name}</span>
              {' '} · รัศมี {settings.allowed_radius} เมตร
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

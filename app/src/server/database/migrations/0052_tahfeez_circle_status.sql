-- مزامنة التوائم (غ٨): حلقة التحفيظ تحتاج حالةً لتنعكس أرشفةُ حلقة السجلّ عليها
-- (كانت الأرشفةُ تُبقي التوأم ظاهرًا في لوحة الإشراف والترتيب والتذكيرات).
ALTER TABLE tahfeez_circles ADD COLUMN status TEXT NOT NULL DEFAULT 'active'; -- active | archived

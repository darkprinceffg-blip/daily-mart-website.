const express=require('express'),{DatabaseSync}=require('node:sqlite'),multer=require('multer'),crypto=require('crypto'),path=require('path'),fs=require('fs');
const {ADMIN_USER,ADMIN_PASS,SECRET,WHATSAPP,PORT=3000}=process.env;
if(!ADMIN_USER||!ADMIN_PASS||!SECRET){console.error('Create .env (see .env.example)');process.exit(1)}
fs.mkdirSync('uploads',{recursive:true});
const db=new DatabaseSync('data.db');
db.exec(`create table if not exists categories(id integer primary key,name text unique);
create table if not exists products(id integer primary key,name text,category_id int,price real,sale_price real,description text,specs text,sizes text,colors text,stock int default 0,image text,section text default '');
create table if not exists orders(id integer primary key,name text,phone text,address text,items text,total real,status text default 'Pending',created text default current_timestamp);
create table if not exists banners(id integer primary key,title text,subtitle text,image text)`);
if(!db.prepare('select count(*) c from categories').get().c){
 ['Electronics','Mobile Phones & Accessories',"Men's Fashion","Women's Fashion","Kids' Fashion",'Shoes & Footwear','Grocery & Food','Beauty & Skincare','Home & Kitchen','Sports & Fitness','Watches','Bags & Accessories','Toys & Games','Stationery'].forEach(n=>db.prepare('insert into categories(name) values(?)').run(n));
 db.prepare('insert into products(name,category_id,price,sale_price,description,specs,sizes,colors,stock,section) values(?,?,?,?,?,?,?,?,?,?)').run('Sample Wireless Earbuds (edit me)',1,4999,3499,'Sample product for demonstration. Edit or delete from the Admin Dashboard.','Bluetooth 5.3\nBattery: 24h','','Black,White',10,'featured');
}
const app=express();app.use(express.json());
const sign=v=>crypto.createHmac('sha256',SECRET).update(v).digest('hex');
const eq=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length==b.length&&crypto.timingSafeEqual(a,b)};
const auth=(req,res,next)=>{const t=(req.headers.cookie||'').match(/adm=(\d+)\.(\w+)/);if(t&&+t[1]>Date.now()&&eq(sign(t[1]),t[2]))return next();res.status(401).json({error:'Unauthorized'})};
let tries={};
app.post('/admin/login',(req,res)=>{const ip=req.ip;tries[ip]=(tries[ip]||0)+1;setTimeout(()=>delete tries[ip],9e5);
 if(tries[ip]>10)return res.status(429).json({error:'Too many attempts, try later'});
 const{user,pass}=req.body;if(!eq(user,ADMIN_USER)||!eq(pass,ADMIN_PASS))return res.status(401).json({error:'Wrong login'});
 const e=Date.now()+432e5;res.setHeader('Set-Cookie',`adm=${e}.${sign(String(e))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV=='production'?'; Secure':''}`);res.json({ok:1})});
app.post('/admin/logout',(q,r)=>{r.setHeader('Set-Cookie','adm=; Max-Age=0; Path=/');r.json({ok:1})});
const up=multer({storage:multer.diskStorage({destination:'uploads',filename:(r,f,cb)=>cb(null,crypto.randomUUID()+path.extname(f.originalname).toLowerCase())}),limits:{fileSize:5e6},fileFilter:(r,f,cb)=>cb(null,/^image\/(jpeg|png|webp|gif)$/.test(f.mimetype))});
const V=(b,k)=>['price','sale_price','stock','category_id'].includes(k)?(Number(b[k])||0):(b[k]??'');
const F=['name','category_id','price','sale_price','description','specs','sizes','colors','stock','section'];
// ---- public API (read-only + place order) ----
app.get('/api/config',(q,r)=>r.json({whatsapp:WHATSAPP}));
app.get('/api/categories',(q,r)=>r.json(db.prepare('select * from categories order by id').all()));
app.get('/api/banners',(q,r)=>r.json(db.prepare('select * from banners order by id').all()));
app.get('/api/products',(q,r)=>{const w=[],a=[],x=q.query;
 if(x.cat){w.push('category_id=?');a.push(x.cat)}if(x.q){w.push('name like ?');a.push('%'+x.q+'%')}if(x.section){w.push('section=?');a.push(x.section)}
 const o={asc:'coalesce(nullif(sale_price,0),price) asc',desc:'coalesce(nullif(sale_price,0),price) desc'}[x.sort]||'id desc';
 r.json(db.prepare(`select * from products ${w.length?'where '+w.join(' and '):''} order by ${o}`).all(...a))});
app.get('/api/products/:id',(q,r)=>{const p=db.prepare('select * from products where id=?').get(q.params.id);p?r.json(p):r.status(404).json({error:'Not found'})});
app.post('/api/orders',(q,r)=>{const{name,phone,address,items}=q.body;
 if(!name||!phone||!address||!Array.isArray(items)||!items.length)return r.status(400).json({error:'Please fill all details'});
 let total=0;const lines=[];
 for(const i of items){const p=db.prepare('select * from products where id=?').get(i.id),n=Math.max(1,parseInt(i.qty)||1);
  if(!p)return r.status(400).json({error:'Product not found'});if(p.stock<n)return r.status(400).json({error:`${p.name}: only ${p.stock} in stock`});
  const pr=p.sale_price>0?p.sale_price:p.price;total+=pr*n;lines.push({id:p.id,name:p.name,price:pr,qty:n,size:i.size||'',color:i.color||''})}
 let oid;db.exec('BEGIN');try{lines.forEach(l=>db.prepare('update products set stock=stock-? where id=?').run(l.qty,l.id));
  oid=db.prepare('insert into orders(name,phone,address,items,total) values(?,?,?,?,?)').run(String(name).slice(0,100),String(phone).slice(0,30),String(address).slice(0,500),JSON.stringify(lines),total).lastInsertRowid;db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 r.json({id:Number(oid),total,items:lines})});
// ---- owner-only API ----
const A=express.Router();A.use(auth);
A.get('/me',(q,r)=>r.json({ok:1}));
A.post('/products',up.single('image'),(q,r)=>{const b=q.body;const id=db.prepare(`insert into products(${F.join()},image) values(${F.map(()=>'?').join()},?)`).run(...F.map(k=>V(b,k)),q.file?q.file.filename:'').lastInsertRowid;r.json({id:Number(id)})});
A.put('/products/:id',up.single('image'),(q,r)=>{const b=q.body;db.prepare(`update products set ${F.map(k=>k+'=?').join()} where id=?`).run(...F.map(k=>V(b,k)),q.params.id);
 if(q.file)db.prepare('update products set image=? where id=?').run(q.file.filename,q.params.id);r.json({ok:1})});
A.delete('/products/:id',(q,r)=>{db.prepare('delete from products where id=?').run(q.params.id);r.json({ok:1})});
A.post('/categories',(q,r)=>{try{db.prepare('insert into categories(name) values(?)').run(q.body.name)}catch(e){return r.status(400).json({error:'Exists'})}r.json({ok:1})});
A.delete('/categories/:id',(q,r)=>{db.prepare('delete from categories where id=?').run(q.params.id);r.json({ok:1})});
A.post('/banners',up.single('image'),(q,r)=>{db.prepare('insert into banners(title,subtitle,image) values(?,?,?)').run(q.body.title||'',q.body.subtitle||'',q.file?q.file.filename:'');r.json({ok:1})});
A.delete('/banners/:id',(q,r)=>{db.prepare('delete from banners where id=?').run(q.params.id);r.json({ok:1})});
A.get('/orders',(q,r)=>r.json(db.prepare('select * from orders order by id desc').all()));
A.put('/orders/:id',(q,r)=>{db.prepare('update orders set status=? where id=?').run(q.body.status,q.params.id);r.json({ok:1})});
app.use('/api/admin',A);
app.use('/uploads',express.static('uploads'));
app.use(express.static('public'));
app.use((e,q,r,n)=>r.status(500).json({error:e.message}));
app.listen(PORT,()=>console.log('Daily Mart running on port '+PORT));

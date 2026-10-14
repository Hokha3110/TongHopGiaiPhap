# Cập nhật backend tại Linux — kaliot.online

Hướng dẫn tiếp tục từ máy Linux đã có Node/npm và đã chép Solutions vào `/opt/tong-hop-giai-phap/Solutions`. Không phải tải lại tài liệu. FE vẫn ở Cloudflare; API chạy trên Linux và được nối qua Tunnel tại `api.kaliot.online`.

## 1. Lấy mã nguồn mới

Trên Windows, commit và push các file mã nguồn đã thay đổi, gồm `server`, `src`, `deploy`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example` và hướng dẫn này. Không thêm `.env`, `Solutions` hoặc `storage`.

Sau đó chạy trên Linux:

```bash
cd /opt/tong-hop-giai-phap
git pull --ff-only
npm ci --omit=dev
sudo apt update
sudo apt install -y postgresql postgresql-contrib libreoffice
sudo systemctl enable --now postgresql
mkdir -p storage/uploads
```

Nếu `git pull` báo có thay đổi cục bộ, giữ lại các thay đổi và xử lý chênh lệch trước khi tiếp tục. Không reset thư mục đang chứa tài liệu.

## 2. Tạo database một lần

```bash
sudo -u postgres createuser --pwprompt tonghop
sudo -u postgres createdb --owner=tonghop tonghop
```

Nhập mật khẩu riêng cho database vào lời nhắc `createuser`. Dùng chuỗi ngẫu nhiên dài gồm chữ và số để dễ đưa vào URL; nếu có `@`, `:`, `/`, `#` hoặc `%`, cần URL-encode chúng trong DATABASE_URL. Không mở cổng PostgreSQL ra Internet.

Nếu database/user đã tồn tại, bỏ qua bước tạo. Không xóa database để chạy lại.

## 3. Sửa .env trên Linux

```bash
cd /opt/tong-hop-giai-phap
nano .env
chmod 600 .env
```

Giữ đường dẫn Solutions đã chép, sửa các giá trị mẫu sau thành thông tin thật:

```dotenv
DATABASE_URL=postgresql://tonghop:MAT_KHAU_DATABASE@127.0.0.1:5432/tonghop
SOLUTIONS_ROOT=/opt/tong-hop-giai-phap/Solutions
UPLOADS_ROOT=/opt/tong-hop-giai-phap/storage/uploads
HOST=127.0.0.1
PORT=8787
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MAT_KHAU_ADMIN_IT_NHAT_12_KY_TU
COOKIE_SECURE=true
COOKIE_SAME_SITE=Lax
CORS_ORIGIN=https://kaliot.online
TRUST_CLOUDFLARE=true
```

`APP_USERNAME` và `APP_PASSWORD` cũ không còn dùng. `ADMIN_*` chỉ để tạo admin đầu tiên; không tự chuyển tài khoản chung cũ thành admin. Mỗi user có mật khẩu được hash bằng scrypt, phiên đăng nhập lưu bằng hash trong PostgreSQL.

```bash
npm run db:setup
```

Lệnh tạo schema, tạo admin nếu database chưa có user, nhập danh mục/bài viết hiện có và lập chỉ mục tài liệu trong Solutions. Nhập lại sẽ bỏ qua file đã có, không ghi đè bài viết, không khôi phục file đang ở thùng rác, không xóa hoặc di chuyển file gốc. File mới thêm trong thư mục của các danh mục cũ có thể nhập lại qua dashboard. Danh mục mới tạo trên dashboard dùng chức năng tải lên.

Sau khi tạo admin thành công, xóa `ADMIN_USERNAME` và `ADMIN_PASSWORD` khỏi `.env`. Từ đó tạo user/đổi mật khẩu trong dashboard. Chạy lại setup không đặt lại mật khẩu admin cũ.

## 4. Chạy API như dịch vụ

File dịch vụ đi kèm dùng user `linuxk` theo terminal của bạn. Nếu server dùng tài khoản khác, sửa `User` và `Group` trước khi cài. `command -v node` phải trả về `/usr/bin/node`; nếu khác, sửa `ExecStart` thành đường dẫn thực.

```bash
sudo chown -R linuxk:linuxk /opt/tong-hop-giai-phap/storage
sudo chown linuxk:linuxk /opt/tong-hop-giai-phap/.env
sudo cp deploy/tonghop-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tonghop-api
curl http://127.0.0.1:8787/api/health
```

Kết quả mong đợi: `{"status":"ok","database":"ok"}`. Nếu lỗi:

```bash
sudo journalctl -u tonghop-api -n 60 --no-pager
```

API có quyền đọc Solutions và ghi storage. Các bản xem trước LibreOffice được tạo trong thư mục tạm riêng của dịch vụ. Nếu muốn đặt Solutions/storage ở nơi khác, cập nhật cả `.env`, quyền truy cập và `ReadWritePaths` của dịch vụ; cập nhật đường dẫn trong script backup tương ứng.

## 5. Nối Cloudflare Tunnel

Tạo tunnel trong Cloudflare dashboard, chọn Linux và cài connector theo lệnh được dashboard cung cấp. Giữ token riêng trên Linux. Trong route của tunnel:

| Trường | Giá trị |
| --- | --- |
| Public hostname | `api.kaliot.online` |
| Service | `http://127.0.0.1:8787` |

Không dùng IP LAN ở cấu hình FE. Không cần mở inbound port 8787 hoặc 5432. `TRUST_CLOUDFLARE=true` chỉ dùng với API lắng nghe loopback và cloudflared chạy cùng máy.

Mở `https://api.kaliot.online/api/health` để kiểm tra route sau khi tunnel hoạt động.

## 6. Cập nhật FE

Trong biến môi trường **build** của dự án frontend trên Cloudflare (Workers Builds hoặc Pages), đặt:

```dotenv
VITE_API_BASE=https://api.kaliot.online
```

Deploy lại frontend từ mã nguồn mới, giữ cấu hình deploy đang dùng cho kaliot.online. Vào `https://kaliot.online/admin` và đăng nhập bằng admin đã tạo. Thành viên dùng trang thư viện bình thường; admin và biên tập viên thấy liên kết Quản trị thư viện. Bảo đảm `/admin` được phục vụ bởi `index.html` (SPA fallback). Với Workers Static Assets, đặt `assets.not_found_handling` thành `single-page-application` trong cấu hình Wrangler nếu chưa có; với Pages, giữ SPA fallback và tránh rule redirect ghi đè.

Không đưa DATABASE_URL hoặc ADMIN_PASSWORD lên FE. Cặp `kaliot.online`/`api.kaliot.online` dùng HTTPS và SameSite=Lax. Nếu dùng tạm tên miền `pages.dev` khác site, cần CORS origin tương ứng và SameSite=None; trình duyệt vẫn có thể chặn cookie bên thứ ba, nên dùng tên miền chính thức.

## 7. Quản trị hằng ngày

- Admin: quản lý tài khoản, quyền, nội dung, tài liệu và xem nhật ký.
- Biên tập viên: quản lý nội dung, ảnh, tài liệu; không quản lý tài khoản hoặc xem nhật ký quản trị.
- Thành viên: đọc nội dung đã xuất bản, xem và tải tài liệu.
- Bài viết: dùng trình soạn thảo Markdown với nút tiêu đề, chữ đậm, danh sách, liên kết, tải ảnh và xem trước. HTML không được thực thi. Lưu nháp giữ nguyên bản đã xuất bản; nút Xuất bản mới đưa thay đổi ra thư viện.
- Ảnh/logo: lưu nháp mục mới trước khi tải ảnh. Ảnh được quản lý như tài liệu thuộc mục đó, truy cập qua API có đăng nhập. Xóa ảnh đó sẽ làm mất ảnh trong bài viết.
- Upload tối đa 90 MB/file để phù hợp tuyến qua Cloudflare. File lớn vẫn chép vào Solutions rồi nhập từ dashboard. File trùng tên được lưu bằng ID khác nhau, không ghi đè file vật lý.
- Thay phiên bản: giữ file cũ và có thể chọn lại phiên bản trước trong dashboard. File đã nhập từ Solutions nên được giữ nguyên trên đĩa; đổi tên hiển thị hoặc thay nội dung qua dashboard.
- Thùng rác: ẩn mục khỏi thành viên, có thể khôi phục. Chưa có xóa file vĩnh viễn; dung lượng file cũ vẫn được tính. Ẩn/gỡ xuất bản giải pháp cũng ẩn các tài liệu của nó khỏi thành viên.
- Khóa tài khoản, đổi quyền hoặc đặt lại mật khẩu thu hồi phiên đăng nhập. Hệ thống bảo vệ quản trị viên cuối cùng và không cho tự khóa/hạ quyền tài khoản đang dùng.

## 8. Sao lưu và khôi phục

Script backup dừng API trong lúc chụp database và tài liệu để hai phần khớp nhau, rồi khởi động lại. Với thư mục lớn, lần sao lưu có thể mất vài phút; thực hiện ngoài giờ. Bản sao chứa `.env` nên thư mục được giới hạn quyền root. Không chạy chép tài liệu qua SCP cùng thời điểm backup.

```bash
sudo bash deploy/backup.sh
sudo cp deploy/tonghop-backup.service deploy/tonghop-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tonghop-backup.timer
systemctl list-timers tonghop-backup.timer
```

Backup chạy mỗi ngày 03:00 theo múi giờ Linux, lưu dưới `/var/backups/tonghop/`. Script giữ tất cả bản sao; theo dõi dung lượng và chuyển bản sao sang nơi lưu trữ khác, rồi chọn chính sách giữ bản trước khi xóa backup cũ. Backup trên cùng ổ đĩa không bảo vệ trước hỏng ổ.

Để khôi phục, trước hết kiểm tra `sha256sum -c SHA256SUMS` tại thư mục backup và giải nén `files.tar.gz` vào một thư mục phục hồi riêng để kiểm tra. Dừng API, sao lưu trạng thái hiện tại, dùng `pg_restore` nhập `database.dump` vào database trống thuộc user `tonghop`, khôi phục Solutions/storage/.env tương ứng, sửa DATABASE_URL nếu dùng tên database khác và kiểm tra quyền file trước khi bật lại API. Không trộn database của một ngày với thư mục file của ngày khác.

## Kiểm thử trước khi cập nhật

```bash
npm ci
npm test
npm run build
```

Bộ kiểm thử dùng PostgreSQL nhúng PGlite với dữ liệu tạm; không kết nối database thật. Kiểm tra thêm `api/health`, đăng nhập và LibreOffice trên Linux sau triển khai. PGlite không thay thế kiểm tra dịch vụ PostgreSQL, quyền thư mục hoặc systemd trên máy đích.

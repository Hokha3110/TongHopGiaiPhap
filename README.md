# Thư viện giải pháp an ninh mạng

React/Vite cho thư viện và dashboard `/admin`, API Node.js, PostgreSQL cho nội dung/tài khoản và ổ đĩa Linux cho file tài liệu. Giao diện thư viện, trang login và luồng xem trước được giữ; danh mục thành viên lấy từ nội dung đã xuất bản trong database.

## Triển khai trên Linux

Xem [DEPLOY-LINUX.md](DEPLOY-LINUX.md). Hướng dẫn tiếp tục từ thư mục `/opt/tong-hop-giai-phap/Solutions` đã chép, gồm tạo PostgreSQL, nhập dữ liệu cũ, admin đầu tiên, systemd, Cloudflare Tunnel, FE tại kaliot.online và backup hằng ngày.

## Chạy local

Cần Node.js 22.12+ hoặc Node.js 24 và PostgreSQL đang chạy. Tạo database riêng cho môi trường local. Cài dependencies:

```sh
npm ci
```

Tạo `.env` tại gốc repo (thay thông tin database/password bằng giá trị thật):

```dotenv
DATABASE_URL=postgresql://tonghop:YOUR_LOCAL_DB_PASSWORD@127.0.0.1:5432/tonghop
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD_AT_LEAST_12_CHARS
HOST=127.0.0.1
PORT=8787
NODE_ENV=development
COOKIE_SECURE=false
COOKIE_SAME_SITE=Lax
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Nếu không đặt SOLUTIONS_ROOT và UPLOADS_ROOT, API đọc `Solutions/` và ghi file mới vào `storage/uploads/` dưới repo. Các thư mục này cùng `.env` được Git bỏ qua. Nếu không có tài liệu cũ, tạo thư mục Solutions rỗng trước khi setup.

```sh
npm run db:setup
npm run dev:all
```

Mở địa chỉ Vite hiển thị, đăng nhập bằng admin vừa tạo rồi vào `/admin`. Xóa ADMIN_USERNAME/ADMIN_PASSWORD khỏi `.env` sau lần setup đầu tiên. Tài khoản và phiên đăng nhập được lưu trong PostgreSQL; APP_USERNAME/APP_PASSWORD của bản cũ không còn dùng.

## Nội dung và tài liệu

- Admin quản lý tài khoản, quyền, nội dung, tài liệu và nhật ký. Editor quản lý nội dung/tài liệu. Member tra cứu và tải tài liệu đã xuất bản.
- Nội dung hỗ trợ Markdown, tải logo/ảnh, xem trước, lưu nháp, xuất bản, gỡ xuất bản và thùng rác. HTML trong bài viết không được thực thi.
- Nhập dữ liệu cũ từ danh mục trong source và Solutions bằng `npm run db:setup`; các lần sau dùng nút Nhập từ Solutions. Nhập lại không ghi đè chỉnh sửa trong database hoặc khôi phục tài liệu đã xóa.
- Tải file mới tối đa 90 MB, đổi tên hiển thị/chuyển danh mục, thay phiên bản, khôi phục phiên bản và thùng rác. File gốc và phiên bản cũ vẫn được giữ trên đĩa.
- Thư mục member, khách hàng/dự án, bản nháp và các mục DevSecOps/A06 đã ẩn tiếp tục được loại khỏi bước nhập cũ.
- PDF, ảnh, video và file văn bản xem trực tiếp; DOCX dùng Mammoth trong iframe sandbox. Các định dạng Office khác dùng LibreOffice trên backend để chuyển PDF. Cài LibreOffice hoặc đặt LIBREOFFICE_PATH trỏ tới soffice để xem PPTX/XLSX.

## Build và kiểm thử

```sh
npm test
npm run build
```

Kiểm thử chạy API thật trên localhost với PostgreSQL nhúng PGlite và thư mục fixture tạm. Bao phủ phân quyền, cookie phiên, lưu nháp/xuất bản, nhập lại không ghi đè, tải/thay/khôi phục tài liệu, thu hồi phiên và nhật ký. Không dùng database thật. Cần kiểm tra PostgreSQL, LibreOffice và dịch vụ trên Linux sau khi triển khai.

Build FE tạo `dist/`. Đặt VITE_API_BASE trong môi trường build Cloudflare thành `https://api.kaliot.online`, không đặt mật khẩu/database trong biến VITE_*. Sau khi đổi URL API, build/deploy lại FE.

Đợt kiểm tra dependency hiện có 3 cảnh báo mức moderate trong chuỗi Mammoth → argparse → sprintf-js của phần xem DOCX cũ. npm đề xuất hạ Mammoth về bản rất cũ, nên chưa áp dụng thay đổi phá tương thích này. Các thư viện PostgreSQL, upload và Markdown mới không nằm trong cảnh báo đó.

# Thư viện giải pháp an ninh mạng

Frontend React/Vite để tra cứu các giải pháp trong `Solutions/`. API Node.js lập chỉ mục tài liệu và gửi file trực tiếp từ thư mục gốc; tài liệu không được chép vào `dist` hay đưa vào Git.

## Chạy tại Windows

Sau khi clone, cài dependencies một lần:

```powershell
npm ci
```

Từ thư mục repo, chạy cả giao diện và API bằng một lệnh:

```powershell
npm run dev:all
```

Lần đầu, tạo `.env` ở thư mục dự án và đặt thông tin đăng nhập:

```env
APP_USERNAME=member
APP_PASSWORD=thay-bang-mat-khau-manh-cua-ban
```

Đây là cấu hình backend; không đặt mật khẩu trong biến `VITE_*`. `.env` đã được Git bỏ qua và không được đưa lên repository. Sau khi sửa, khởi động lại `npm run dev:all` để áp dụng. `.env.example` là mẫu dành cho cấu hình triển khai, không cần chép nguyên xi khi chạy local.

Mở địa chỉ Vite hiển thị trên terminal (thường là `http://localhost:5173`). API đọc thư mục `Solutions/` ngay trong repo và quét lại mỗi 5 phút. Nếu tài liệu nằm ở đường dẫn khác, đặt `SOLUTIONS_ROOT` trước khi chạy.

Muốn mở giao diện riêng, `npm run dev` vẫn chạy được; tìm kiếm và mở tài liệu cần API nên yêu cầu này không nối file thật.

## Nội dung được lập chỉ mục

- 25 thư mục giải pháp có tài liệu được hiển thị từ `Solutions/`.
- 7 thư viện dùng chung: kiến trúc tổng thể, giải pháp theo cấp độ, Cyber Range Keysight, sales kits, bài trình bày và tài liệu tham khảo chung.
- Định dạng được hỗ trợ gồm PDF, Office, hình ảnh, video và file nén.
- Bấm vào tài liệu để xem ngay PDF, ảnh, video, file văn bản/CSV và DOCX; DOCX được dựng thành bản xem nhanh ngay trong trình duyệt, cách trình bày có thể khác Word. DOC/RTF, Excel, PowerPoint và OpenDocument được API chuyển sang PDF để xem trong web; file Office vẫn có nút tải xuống. File nén tải về để mở bằng ứng dụng trên máy.
- Để xem trước DOC/RTF, Excel, PowerPoint và OpenDocument, cài LibreOffice trên máy chạy API để có lệnh `soffice` (hoặc đặt `LIBREOFFICE_PATH`). Khi chưa có LibreOffice, DOCX vẫn xem được; các định dạng Office còn lại báo rõ yêu cầu máy chủ và cho tải file.

Trên Ubuntu, cài bộ chuyển đổi bằng:

```sh
sudo apt-get update
sudo apt-get install -y libreoffice
```
- Không lập chỉ mục khu vực dành riêng cho member, thư mục khách hàng/dự án và bản nháp, tránh trộn nội dung cá nhân hoặc theo khách hàng vào thư viện dùng chung.
- Các thư mục `01. DevSecOps` và `26. A06` đang ẩn khỏi danh mục; thư mục và file gốc vẫn được giữ trên ổ đĩa.

Đợt kiểm kê hiện tại tìm thấy **308 tài liệu** trong 25 giải pháp có tài liệu và 7 bộ sưu tập dùng chung.

## Build frontend

```sh
npm run build
```

Thư mục đầu ra là `dist`. Không đưa `Solutions/` vào build output. API cần chạy trên máy chủ có quyền đọc thư mục tài liệu.

## Deploy frontend và API

Đặt `VITE_API_BASE` thành URL API trước khi build frontend, đồng thời đặt `CORS_ORIGIN` trên API bằng đúng origin của website. Bảo vệ cả website lẫn API bằng cùng cổng xác thực nội bộ. API mặc định chỉ lắng nghe `127.0.0.1`; khi nối Cloudflare Pages với Linux server, dùng reverse proxy/tunnel và xác thực nội bộ (ví dụ Cloudflare Access hoặc VPN). Không mở API trực tiếp ra Internet.

Ứng dụng cũng có màn hình đăng nhập riêng. Backend đọc `APP_USERNAME` và `APP_PASSWORD` từ `.env` hoặc biến môi trường; mật khẩu không được gửi vào bundle frontend. Sau đăng nhập, API cấp cookie `HttpOnly` 12 giờ và yêu cầu cookie đó cho danh mục, tìm kiếm, xem trước và tải tài liệu. Trên Linux, đặt hai biến này trong file `.env` chỉ đọc được bởi tài khoản dịch vụ, hoặc cấu hình qua systemd `EnvironmentFile`. Không commit file này. Nếu website và API ở hai site khác nhau, phục vụ cả hai qua HTTPS, đặt `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=None`, và khai báo chính xác origin website trong `CORS_ORIGIN`.

# ASIC Works — works.kaliot.online

ASIC Works là một frontend riêng trong cùng repository. Dự án, task, PoC và test case được lưu trong PostgreSQL qua API Linux hiện có. Trang thư viện vẫn build bằng `npm run build`; trang Works build bằng `npm run build:works`.

## Chạy trên máy code

```powershell
npm ci
npm run dev:works
```

Để chạy backend local trên Windows, copy `.env.backend.local.example` thành `.env.backend.local`, dừng API cũ rồi chạy `npm run api:dev` trong cửa sổ khác. Lệnh này nạp cấu hình development và cookie HTTP cho localhost; thông tin kết nối database vẫn được đọc từ `.env`. Giữ `VITE_API_BASE=` trong `.env.development.local` khi dùng backend này. File `.env.backend.local` không đưa lên Git.

Mở địa chỉ Vite hiển thị, mặc định `http://localhost:5174`. Giữ API hiện có hoạt động. Nếu `.env` có `VITE_API_BASE=https://api.kaliot.online`, trình duyệt gọi API production; để dùng API local khi phát triển, đặt `VITE_API_BASE=` trong môi trường phát triển và chạy API local có database riêng. Không sao chép database production vào bài kiểm tra.

## Cập nhật API Linux một lần

Sau khi source mới đã được push:

```bash
cd /opt/tong-hop-giai-phap
git pull --ff-only
npm ci --omit=dev
npm run db:migrate
```

Migration bổ sung bảng dự án và thành viên. Nó giữ bài viết, tài liệu và tài khoản hiện có. Theo quy trình backup đang dùng trước khi áp dụng migration production.

Trong `.env` Linux, mở rộng danh sách origin (giữ các origin đang cần):

```dotenv
CORS_ORIGIN=https://kaliot.online,https://works.kaliot.online
```

Tiếp tục giữ `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=Lax`, `HOST=127.0.0.1`, `PORT=8787` và đường dẫn dữ liệu Linux hiện tại. Sau đó:

```bash
sudo systemctl restart tonghop-api
curl http://127.0.0.1:8787/api/health
```

API dùng tài khoản và phiên đăng nhập nội bộ hiện tại. Vì cả hai site cùng gọi `api.kaliot.online`, người đã đăng nhập có thể được nhận diện ngay trên Works. Đăng xuất thu hồi phiên này.

## Tạo frontend Cloudflare Pages riêng

Trong Workers & Pages, tạo dự án Pages mới từ cùng Git repository, đặt tên ví dụ `asic-works`:

| Cấu hình | Giá trị |
| --- | --- |
| Root directory | Gốc repository, để trống |
| Build command | `npm run build:works` |
| Build output directory | `dist-works` |
| Biến môi trường build | `VITE_API_BASE=https://api.kaliot.online` |

Chờ build thành công, vào **Custom domains → Set up a custom domain**, thêm `works.kaliot.online` và hoàn tất bước DNS mà Cloudflare hướng dẫn. Không thay custom domain `kaliot.online` của dự án thư viện. Đăng nhập trên domain `works.kaliot.online` sau khi chứng chỉ HTTPS đã sẵn sàng; domain `pages.dev` khác site có thể không dùng được cookie `SameSite=Lax`.

Frontend này có sẵn SPA fallback `_redirects`, chặn lập chỉ mục và header cho static assets. Không cần tạo tunnel mới: API vẫn đi qua tunnel `api.kaliot.online → http://127.0.0.1:8787`.

Tham khảo chính thức: [Cloudflare build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## Quyền và cách sử dụng

- Mọi tài khoản đang hoạt động có thể tạo dự án của mình.
- Chủ dự án và admin quản lý thành viên, sửa dự án, lưu trữ hoặc mở lại dự án.
- Thành viên có quyền **Cập nhật** sửa công việc, PoC, test case và tiến độ. Thành viên **Chỉ xem** đọc dữ liệu và sao chép báo cáo.
- Ngoài chủ dự án/thành viên, chỉ admin hệ thống được đọc dự án. Quyền được kiểm tra ở API cho cả danh sách lẫn từng dự án.
- Mỗi lần lưu dùng revision để tránh ghi đè người vừa cập nhật. Nếu gặp thông báo xung đột, tải lại dự án để lấy dữ liệu mới trước khi lưu tiếp.
- Lưu trữ giữ lịch sử trong database. Bản này không xóa vĩnh viễn dự án.
- Công việc có lý do, giai đoạn, input, output, kết quả, người phụ trách và hạn hoàn thành.
- PoC có lịch, mục tiêu, phạm vi, môi trường, đầu vào/đầu ra và kết luận. Test case ghi bước làm, kết quả mong đợi, thực tế và bằng chứng dạng ghi chú/link.
- Nhật ký và nút sao chép báo cáo giúp tổng hợp tiến độ, vướng mắc và bước tiếp theo để báo cáo quản lý.

## Kiểm tra trước bàn giao

Tạo dự án bằng tài khoản A, thêm tài khoản B quyền Chỉ xem rồi Cập nhật để kiểm tra sự khác biệt. Tài khoản C chưa được thêm sẽ không thấy dự án và không mở được link chi tiết. Tạo một task có input/output, một test case và một cập nhật; tải lại trang để kiểm tra dữ liệu đã lưu. Lưu trữ rồi mở lại dự án để kiểm tra lịch sử còn nguyên.

Nếu web báo lỗi kết nối, kiểm tra `VITE_API_BASE` lúc build, origin Works trong `.env` API và việc đã chạy `npm run db:migrate`. Xem log bằng `sudo journalctl -u tonghop-api -n 60 --no-pager`.

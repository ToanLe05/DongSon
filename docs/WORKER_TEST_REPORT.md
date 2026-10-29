# Python trong Web Worker — kiểm tra ngày 29/10/2026

Bản mặc định gọi `LocalClient → WorkerRpc → python.worker → browser_bridge → DongSonGame`. Worker dùng Pyodide 0.29.5 / Python WebAssembly 3.13.2. Giữ nguyên tệp luật Python và bộ chuyển trạng thái; không chuyển luật sang JavaScript.

## Cách kiểm tra

- Build Vite chứa Worker, ba tệp Python dưới dạng nguồn và năm tệp runtime Pyodide được phục vụ cùng website; không dùng CDN.
- Playwright mở bản `dist/` bằng máy chủ chỉ phục vụ tệp tĩnh, tại `/dongson/`. Mọi yêu cầu tới `/api/` và tên miền ngoài đều bị chặn và tính là lỗi kiểm thử.
- Ván thường đi tới Tiến Cung sau khi đã ngắt mạng, rồi khóa ván, chơi lại và đi nước mới.
- Các thế đặc biệt được tạo thành bản lưu IndexedDB bằng công cụ thử, không thêm đường dẫn nạp thế vào bản phát hành.
- Kiểm tra đầy đủ phong cấp Ngựa/Voi/Gà cho Thủy và Sơn, hủy lựa chọn, tải lại, đầu hàng và chơi lại.
- Kiểm tra chiếu hạ, trơ Thần, bí nước, lặp thế qua tải lại, mốc 99 → 100 và yêu cầu hòa, Hoán Quân, khóa Cung và đóng băng e5.
- Kiểm tra hàng đợi lệnh, ID phản hồi, lỗi/hết thời gian, bản lưu giao dịch và xung đột giữa hai Worker dùng cùng khóa tab.
- Chạy 128 phép tính luật liên tiếp trong Worker, đồng thời đo bộ đếm nhịp giao diện ở luồng chính.
- Chạy cầu nối dưới CPython với `-S` (không nạp site-packages): khởi tạo ván và đi quân thành công, không nhập FastAPI.

## Kết quả

| Nhóm | Kết quả |
| --- | --- |
| Luật/API đối chiếu và cầu nối dưới CPython | 115 đạt |
| JavaScript, gồm vòng đời RPC/Worker | 31 đạt |
| Build Vite + runtime được phân phối cùng website | Thành công |
| Giao diện Python/WebAssembly trên hosting tĩnh | 18 luồng phân biệt đạt |

Lỗi Python không dự kiến được trả về với mã `worker_unavailable`: cầu nối đóng trình thông dịch đó, giải phóng các yêu cầu chờ và cho phép tạo Worker mới từ bản lưu đã ghi. Xung đột luật hoặc lỗi ghi IndexedDB không bị coi là lỗi trình thông dịch. Lệnh chỉ được xác nhận sau khi ghi bản lưu thành công; trường hợp không ghi được sẽ trả lại thế trước thao tác.

Đã chạy đủ 17 luồng ban đầu, tất cả đạt. Sau bổ sung xử lý lỗi trình thông dịch Python, build lại và chạy ba luồng: nhịp giao diện, Worker bị ngắt, lỗi Python thật trong cầu nối. Cả ba đạt; một luồng mới và hai luồng kiểm tra lại, tổng cộng 18 luồng phân biệt. Không có yêu cầu FastAPI/CDN hoặc lỗi JavaScript chưa xử lý trên giao diện trong các bài đạt.

Nhật ký: `.test-artifacts/local-ui-full-results.json`, `local-ui-recovery-results.json`; bản tổng hợp không đếm trùng: `local-ui-summary.json`. Ảnh bàn cờ offline/chơi lại và điện thoại nằm trong `.test-artifacts/ui-screenshots/local-worker-offline-rematch.png` và `local-worker-mobile.png`.

Ở lượt cuối, Worker hoàn thành 128 phép tính trong khoảng 7,32 giây; bộ đếm nhịp ở luồng giao diện vẫn tăng 40 lần trong khoảng đó. Đây là phép kiểm không chặn luồng chính, không phải số khung hình/giây.

## Phạm vi xác nhận

Kiểm thử bằng Chromium trên Windows x64. Bộ đếm nhịp xác nhận giao diện vẫn xử lý công việc trong khi Worker tính toán trên máy thử; không phải cam kết tốc độ trên mọi thiết bị. Bản lưu chỉ ở trình duyệt; chưa có PWA bảo đảm mở lại trang hoàn toàn offline. Dockerfile chưa được build vì Docker Engine chưa chạy.

Hướng dẫn chạy và triển khai tĩnh: [WEB.md](WEB.md). Luật đã chốt: [RULES.md](../RULES.md). Báo cáo FastAPI trước đây được giữ riêng tại [WEB_TEST_REPORT.md](WEB_TEST_REPORT.md).

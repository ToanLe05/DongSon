# Kiểm tra màn chọn cách chơi

Ngày kiểm tra: 29/10/2026. Bản web tĩnh dùng Python/Pyodide trong Web Worker; không gọi FastAPI hoặc CDN.

## Thay đổi

- Trước trận có Hai người hoặc Chơi với bot, chọn cầm Thủy/Sơn và Bắt đầu trận đấu.
- Thủy luôn đi trước; người cầm Sơn nhận một nước mở đầu từ bot trước khi được thao tác.
- Bot cơ bản chọn ngẫu nhiên một nước hợp lệ, gồm cả phong cấp; chấp nhận đề nghị hòa hợp lệ. Chưa có thuật toán tìm kiếm hoặc mức độ khó.
- Giao diện khóa lượt bot, chống nhấp bắt đầu lặp và hiện nút thử lại nếu bot lỗi. Lệnh bot được kiểm tra gameId/revision, khóa sau kết thúc và lưu bằng cùng giao dịch với nước người chơi.
- Chế độ/bên cầm quân được lưu trong trạng thái, IndexedDB và JSON. Bản lưu cũ mặc định là Hai người. Khi kết thúc có thể chọn lại chế độ trước khi Chơi lại.

## Kết quả

- `npm test`: 34/34 đạt.
- `npm run test:bridge`: 29/29 đạt, gồm lượt mở đầu của hai bên, chặn sai lượt/lệnh lặp, khóa ván, ba kiểu phong cấp của bot, hòa, cấu hình sai và tương thích bản lưu cũ.
- `npm run test:files`: 27/27 đạt.
- `npm run test:web:browser -- setup.spec.cjs`: 4/4 đạt với bộ Python thật dưới đường dẫn con `/dongson/`.
- Bốn ca giao diện: Hai người đi luân phiên; người cầm Thủy và bot đáp lại, tải lại và hòa; người cầm Sơn nhận đúng một nước mở đầu, tải lại và chuyển về Hai người sau kết thúc; màn hình 390×844 chọn được chế độ/bên và bắt đầu trận.

Ảnh và báo cáo nằm trong `.test-artifacts/ui-screenshots/setup-mobile.png`, `setup-rematch.png` và `.test-artifacts/local-ui-results.json`. Các tệp này không đưa vào gói mã nguồn. Bộ kiểm tra này không đánh giá sức mạnh chơi của bot hoặc thay thế bộ kiểm tra toàn bộ luật.

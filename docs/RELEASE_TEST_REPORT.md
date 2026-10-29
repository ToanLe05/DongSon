# Kiểm tra bản web trước phát hành — 29/10/2026

## Phạm vi

Bản website tĩnh chạy Python/Pyodide trong Web Worker. Kiểm tra trình duyệt dùng Chromium trên Windows, ở đường dẫn con `/dongson/`, gồm màn hình máy tính và viewport điện thoại. Các ca trình duyệt chặn FastAPI và CDN. Bot hiện là `random`; không có đánh giá sức mạnh hoặc mô hình đã huấn luyện.

## Kết quả đã xác nhận

| Nhóm | Kết quả |
| --- | --- |
| JavaScript, đồng bộ và điều phối lượt | 48/48 đạt |
| Python: luật, API cũ, agent, quyền thao tác, cầu nối và tệp ván | 188/188 đạt |
| Giao diện web | 36/36 ca duy nhất đạt qua hai đợt: 14 ca đầu và 22 ca tiếp theo |
| Build GitHub Pages | Thành công với base `/DongSon/` |

Một ca có nhiều lần khởi tạo lại Python vượt giới hạn tổng 180 giây ở đợt đầu. Giới hạn riêng của bài thử này được tăng lên 300 giây; ca đó đạt khi chạy lại cùng 21 ca còn lại. Mỗi lần chờ nạp bộ luật vẫn có giới hạn 120 giây. Các kiểm tra về bàn, lượt, dữ liệu lưu, kết quả và chơi lại đều được giữ đầy đủ.

## Quy định đã kiểm tra

| Yêu cầu | Bằng chứng |
| --- | --- |
| Hai người chơi luân phiên | Ca setup và ván tự nhiên đến Tiến Cung, rồi chơi lại |
| Người chọn Sơn thì bot cầm Thủy đi trước | Ca setup, khôi phục và giữ cấu hình khi chơi lại |
| Chỉ điều khiển bên đã chọn | Bộ luật từ chối lệnh sai màu; giao diện bỏ qua chọn/đi quân đối phương |
| Bot chỉ một nước mỗi lượt | Kiểm tra revision/số nước, chặn gửi đồng thời và phản hồi đến muộn |
| Không đi sau kết thúc | Từ chối `/ai_move`, giữ kết quả khi tải lại và khi phản hồi cũ được trả muộn |
| Bắt quân và phong cấp của bot | Hai thế đối xứng chỉ có ba lựa chọn bắt quân kèm phong cấp; agent chọn loại quân, không mở hộp thoại |
| Phong cấp của người | Các ca chọn/hủy ba loại quân ở cả hai bên, tải lại và tiếp tục |
| Đầu hàng luôn là bên người chơi trong chế độ bot | Python kiểm tra cả hai bên và cả hai lượt; giao diện cố ý giữ phản hồi bot khi xác nhận đầu hàng |
| Agent không đề nghị hòa/đầu hàng | Từ chối đề xuất không phải `Move` và yêu cầu với màu của bot |
| Lỗi chọn nước không sửa ván thật | Python: agent cố ý sửa bản sao và ném lỗi, bàn/lượt/lịch sử/revision giữ nguyên. Chromium: chèn phản hồi `bot_error`, bàn và phiên bản giữ nguyên, rồi thử lại thủ công |
| Lưu/tải giữ chế độ và bên cầm quân | Xuất/nhập JSON thật, tải lại, phiên mới và bản lưu ở cả hai lựa chọn bên |
| Chơi lại giữ lựa chọn và cho đổi | Giữ bot/Sơn rồi chơi lại; tiếp tục đổi sang Hai người trước ván mới |

## Chạy lại

```text
npm test
node scripts/run-python.cjs -m pytest src tests/test_bot_agent.py tests/test_bot_policies.py tests/test_browser_bridge.py tests/test_game_files.py -q -p no:cacheprovider
npm run build
npm run test:web:browser -- --trace=off
npm run build:pages -- --base /DongSon/
```

Python cài riêng chỉ phục vụ kiểm thử, theo môi trường trong README. Người chơi không cần cài Python.

Báo cáo tổng hợp: `.test-artifacts/release-ui-summary.json`, kiểm tra đủ 36 ca duy nhất từ `release-ui-pass1.json` và `release-ui-pass2.json`. Báo cáo lần chạy cuối: `.test-artifacts/local-ui-results.json`. Ảnh trong `.test-artifacts/ui-screenshots/`. Các tệp sinh ra này không nằm trong gói mã nguồn. Chưa xuất bản lên GitHub Pages, chưa tạo lại bản `.exe`, và không coi viewport điện thoại là kiểm tra trên thiết bị iOS/Android thật.

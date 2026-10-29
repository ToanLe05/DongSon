# Báo cáo kiểm thử giao diện trọn luồng

Đã chạy lại đủ 31 luồng ngày 29/10/2026: tất cả đạt. Các thay đổi web và kiểm tra bản đóng gói mới nằm trong [WEB_TEST_REPORT.md](WEB_TEST_REPORT.md). Phần bên dưới giữ báo cáo chi tiết của ngày 28/10.

Ngày kiểm tra: **28/10/2026**, múi giờ Asia/Saigon.

## Kết quả

**31 kịch bản phân biệt có kết quả cuối cùng đạt; không còn kịch bản lỗi hoặc chưa chạy.** Đã phát hiện và sửa một lỗi thông báo còn lưu sau khi người chơi thử lại thành công. Bản dựng sau sửa cũng tạo thành công.

Chạy bằng Chromium 141.0.7390.37 (Playwright 1.56.1), Windows x64, Python 3.12.10 trong `.venv`, Node 24.18.0. Trình duyệt chạy headless với bàn cờ Pixi thật và máy chủ FastAPI thật trên cổng thử 8001; giao diện Vite ở 4173. Một worker để các thế thử không ghi đè ván của nhau.

Bộ ghi nhận đã lưu **100 yêu cầu đi quân từ giao diện** trong các lần chạy đạt được chọn làm kết quả cuối; hai luồng dùng thế cũ cố ý tạo yêu cầu bị từ chối. Không có lỗi JavaScript chưa được xử lý trong nhật ký của 31 kịch bản.

## Độ bao phủ

| Luồng | Số kịch bản | Kết quả |
| --- | ---: | --- |
| Ván chuẩn: 11 nửa lượt đến thắng Tiến Cung, chơi lại và đi nước mới | 1 | Qua |
| Ván chuẩn: 7 nửa lượt, có bắt quân, đầu hàng rồi chơi lại | 1 | Qua |
| Nước Tiến Cung quyết định cho Thủy và Sơn | 2 | Qua |
| Nước chiếu hạ quyết định cho Thủy và Sơn | 2 | Qua |
| Bị chiếu → từ chối nước không hóa giải → thoát chiếu → kết thúc → chơi lại | 1 | Qua |
| Sính lễ bị đe dọa: không xử thắng Tiến Cung; bắt quân rồi tiếp tục ván | 1 | Qua |
| Bắt quân cuối gây hòa trơ Thần; nước đi tạo hòa bí nước | 2 | Qua |
| Hai chu kỳ di chuyển thật tạo lần lặp thứ ba | 1 | Qua |
| Đồng hồ 99 → đi một nước thành 100 → yêu cầu hòa | 1 | Qua |
| Hoán Quân cho cả hai bên: giữ đúng ID và đổi chỗ cả Thần lẫn Voi | 2 | Qua |
| Ngựa/Gà phong cấp vào e5 đóng băng, từ chối đi tiếp | 2 | Qua |
| Sính lễ không rời Cung, vẫn di chuyển được trong Cung | 1 | Qua |
| Phong cấp 3 loại × 2 màu: Escape, chọn lại, đi quân mới, kết thúc, chơi lại | 6 | Qua |
| Vừa bắt quân vừa phong cấp: Hủy, xác nhận đúng một lần, đi tiếp và chơi lại | 1 | Qua |
| Đề nghị → từ chối → đề nghị lại → đồng ý hòa, lặp ba ván | 1 | Qua |
| 390×844: hòa 50 nước, xác nhận/hủy đầu hàng, tải lại kết quả | 1 | Qua |
| Hiển thị các thế đã kết thúc được nạp sẵn | 3 | Qua |
| Trang giữ ván cũ: đồng bộ và đi tiếp thành công | 1 | Qua |
| Thông báo lỗi cũ được xóa sau thử lại, rồi kết thúc và chơi lại | 1 | Qua |
| **Tổng** | **31** | **Qua** |

Các thế đặc biệt được **đặt trước ở trạng thái chưa kết thúc** bằng tuyến thử riêng. Nước đi quyết định, chọn phong cấp, trả lời hòa, đầu hàng và Chơi lại đều thực hiện qua chuột/nút trên giao diện. Các phép đọc API chỉ đối chiếu kết quả; yêu cầu sửa ván qua API sau kết thúc phải bị từ chối. Ba bài “hiển thị thế đã kết thúc” được ghi riêng, không dùng thay cho các bài chơi đến kết quả.

Riêng mốc 50 nước bắt đầu từ đồng hồ 99, không giả định đã chơi 100 nửa lượt từ khai cuộc. Lặp thế dùng tám nửa lượt thật. Bộ này kiểm tra các đường đi xác định, không chứng minh mọi ván cờ hoặc mọi thế nhập tùy ý đều đúng.

## Ván từ xuất phát chuẩn đến kết quả tự nhiên

Hai bên chơi phối hợp để kiểm tra luồng, không dùng AI:

| Lượt | Thủy | Sơn |
| --- | --- | --- |
| 1 | Thần e1 → d2 | Bộ a8 → a7 |
| 2 | Thần d2 → e3 | Bộ a7 → a6 |
| 3 | Đinh d3 → d4 | Bộ a6 → a5 |
| 4 | Voi b1 → d3 | Bộ a5 → a4 |
| 5 | Thần e3 → e5 | Bộ k8 → k7 |
| 6 | Voi d3 → e4: **Thủy thắng Tiến Cung** | Ván đã khóa |

Cả 11 nửa lượt đều gửi đúng một yêu cầu đi quân. Sau đó bài thử bấm Chơi lại, xác nhận đủ 36 quân, lượt Thủy, đồng hồ 0, không còn nước cuối/đề nghị hòa, rồi đi a2 → a3 và kiểm tra đến lượt Sơn.

## Kiểm tra sau khi kết thúc

Các luồng quyết định mới dùng chung kiểm tra:

1. Lý do thắng–hòa hiển thị đúng, nút Chơi lại hoạt động, không còn hộp thoại hoặc nút thao tác ván đang chơi.
2. Nhấp bàn cờ không gửi thêm nước đi. Gửi trực tiếp `/move` nhận 409; trạng thái cuối không thay đổi.
3. Chơi lại tạo `gameId` khác, phục hồi 36 quân, lượt Thủy, đồng hồ và số nước bằng 0, xóa nước cuối và đề nghị hòa.
4. Đi nước đầu của ván mới qua bàn cờ thành công, chỉ một yêu cầu, chuyển sang lượt Sơn.
5. Không có lỗi JavaScript chưa được xử lý trong trình duyệt.

Đã xem ảnh đối chiếu tại năm mốc: thắng Tiến Cung từ khai cuộc, ván mới sau nước đầu, chiếu hạ, Hoán Quân và bắt quân kèm phong Voi. Nhãn kết quả, vị trí quân, dấu phong cấp và bố cục trong các ảnh khớp thế kiểm tra.

## Lỗi phát hiện và cách sửa

**Thông báo “Thế cờ đã thay đổi. Hãy chọn quân và thử lại.” vẫn hiển thị sau khi nước đi thử lại đã được chấp nhận.**

Bài thử mới xác nhận máy chủ đã ghi đúng một nước hợp lệ nhưng ô thông báo lỗi chưa rỗng, nên báo lỗi tại `recovery.spec.cjs`. Đã sửa [MatchController.js](../src/ui/MatchController.js) để xóa thông báo cũ khi nhận trạng thái mới. Chạy lại chính bài này đã qua cả phần hiển thị, đầu hàng, khóa ván, chơi lại và nước đi mới.

## Cách chạy lại

Tại thư mục gốc, sau khi cài thư viện/trình duyệt theo [readme.md](../readme.md):

```powershell
npm.cmd run test:browser
```

Bộ hiện tại có 31 bài. Không bật thủ công máy chủ thử; cần để trống cổng 4173 và 8001. Ván chơi bình thường ở 8000 không bị dùng.

Mã kiểm thử:

- [full-match.spec.cjs](../tests/browser/full-match.spec.cjs): các nước quyết định và chuỗi ván chuẩn.
- [match.spec.cjs](../tests/browser/match.spec.cjs): hòa, phong cấp hai màu, màn hình nhỏ và khôi phục.
- [promotion-capture.spec.cjs](../tests/browser/promotion-capture.spec.cjs): bắt quân kèm phong cấp.
- [recovery.spec.cjs](../tests/browser/recovery.spec.cjs): lỗi cũ → thử lại → kết thúc → chơi lại.
- [helpers.cjs](../tests/browser/helpers.cjs): đối chiếu yêu cầu, trạng thái cuối, reset và nhật ký lỗi.
- [browser_server.py](../tests/browser_server.py): chỉ đặt thế cho kiểm thử; không thêm tuyến thử vào máy chủ chạy bình thường.

## Bằng chứng của lần chạy này

Kết quả được chạy theo nhóm, không trình bày như một lần chạy duy nhất:

| Nhóm | Đạt | Lỗi |
| --- | ---: | ---: |
| Các nước kết thúc cốt lõi | 7 | 0 |
| Các luồng còn lại | 22 | 0 |
| Bắt quân/phong cấp và bài phát hiện lỗi thông báo | 1 | 1 |
| Chạy lại bài thông báo sau sửa | 1 | 0 |

Bài lỗi ở nhóm ba trùng bài đạt ở nhóm bốn. Chọn kết quả cuối cho từng tên bài cho ra **31/31 đạt**. Sau sửa chỉ chạy lại bài hồi quy chịu tác động; không chạy lại toàn bộ 31 bài trong một lượt.

Các tệp bằng chứng dưới đây là kết quả được sinh tại máy hiện tại, nằm trong thư mục bỏ qua khi lưu mã nguồn:

- [Tổng hợp từng bài, thời gian, số yêu cầu và lịch sử chạy](../.test-artifacts/ui-full-summary.json).
- [Nhóm cốt lõi](../.test-artifacts/ui-core-results.json), [nhóm còn lại](../.test-artifacts/ui-remaining-results.json), [lần phát hiện lỗi](../.test-artifacts/ui-additional-results.json), [bài chạy lại sau sửa](../.test-artifacts/ui-recovery-final-results.json).
- Ảnh tại `.test-artifacts/ui-screenshots/`; trace/ảnh lỗi trước sửa tại `.test-artifacts/ui-additional-artifacts/`. Kết quả của nhóm trước được giữ trong `ui-core-artifacts/` và `ui-remaining-artifacts/`.
- `npm run build`: thành công sau sửa.

Nếu chạy lại toàn bộ, `.test-artifacts/ui-results.json` và `test-results/` sẽ được cập nhật cho lần mới. [Tệp tổng hợp của báo cáo này](../.test-artifacts/ui-full-summary.json) giữ lại số liệu đã đối chiếu ở trên.


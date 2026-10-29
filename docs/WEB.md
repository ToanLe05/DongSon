# Bản web hai người — Python trong trình duyệt

Bản mặc định hiện là **website tĩnh**. Hai người luân phiên trên cùng thiết bị. Bộ luật Python gốc chạy bằng Pyodide trong Web Worker; không cần FastAPI, tài khoản, máy chủ Python hoặc CDN để tính nước đi.

## Chạy và phát triển

Cài Node 24/npm 11, rồi chạy tại thư mục dự án:

```text
npm ci
npm run build
npm start
```

Mở http://localhost:8000. Nếu cổng đang bận: `npm start -- --port 8080`. Phát triển bằng `npm run dev`; không cần mở máy chủ API. Người truy cập trang web chỉ cần trình duyệt có WebAssembly, Web Worker, IndexedDB và WebGL, không cần cài Node hay Python.

## Đưa lên web

Với GitHub Pages, dùng `npm run build:pages -- --repository OWNER/REPO` để tạo `dist-pages/` theo đúng tên repo. Xem [hướng dẫn Pages và workflow triển khai](GITHUB_PAGES.md). Lệnh `npm run build` thông thường bên dưới vẫn tạo `dist/` với đường dẫn tương đối.

Đưa **toàn bộ nội dung `dist/`** lên hosting tĩnh. Có thể phục vụ ở gốc tên miền hoặc đường dẫn con như `/DongSon/`; đã kiểm tra bản build dưới `/dongson/`. Các URL Worker, ảnh và Python runtime đều đi theo vị trí trang.

Không bỏ thư mục `python-runtime/` hoặc các tệp trong `assets/`. Hosting cần phục vụ `.js`/`.mjs` bằng JavaScript MIME và `.wasm` bằng `application/wasm`. Dùng HTTPS trên hosting, hoặc localhost khi phát triển; không mở `dist/index.html` qua `file://`.

Dockerfile mới cũng chỉ phục vụ tệp tĩnh bằng Node, không cài Python:

```text
docker build -t dongson-web .
docker run --rm -p 8000:8000 dongson-web
```

Container đọc `PORT` (mặc định 8000) và `HOST` (mặc định 0.0.0.0). Tệp tĩnh không có ván cờ trong bộ nhớ máy chủ nên không cần khóa một worker/replica như kiến trúc FastAPI cũ. Docker Engine trên máy kiểm thử chưa chạy, nên chưa xác nhận build container.

## Bộ chạy và luồng dữ liệu

- Pyodide **0.29.5**, Python WebAssembly **3.13.2**; khóa trong package-lock.json.
- Vite đóng gói nguyên văn `dongson_engine.py`, `serializers.py`, `browser_bridge.py` vào Worker. Không viết lại luật sang JavaScript.
- `LocalClient → WorkerRpc → python.worker → BrowserSession → DongSonGame`.
- Cầu nối trả JSON cùng dạng trạng thái mà giao diện đang dùng; mỗi lệnh có ID riêng. Không gửi nước đi, thế cờ hoặc kết quả tới API.
- Một hàng đợi bao gồm cả khởi tạo, tính luật và lưu ván. Các lệnh sửa ván vẫn kiểm tra gameId/revision và khóa kết quả cuối.
- Cầu nối không dùng SharedArrayBuffer; hosting thử chỉ có các MIME thông thường, không cần COOP/COEP. Khi hết thời gian, đóng Worker và khôi phục từ bản lưu.
- Bộ chạy Python khoảng 12,3 MB chưa nén, được phân phối cùng website, không tải từ CDN. Lần mở đầu có thông báo tải bộ luật.
- Sau khi tải xong, có thể chơi tiếp khi mất mạng. Chưa có service worker/PWA đảm bảo mở lại trang hoàn toàn offline sau khi đóng trình duyệt hoặc xóa cache.

## Lưu và khôi phục ván

Mỗi tab thông thường có một ván riêng. Tab giữ khóa ở sessionStorage; dữ liệu ván nằm trong IndexedDB. Tải lại cùng tab khôi phục bàn, ID quân, lượt, phong cấp/khóa Cung/đóng băng, lịch sử nước đi, đồng hồ, quyền Hoán Quân, lịch sử lặp, đề nghị hòa và kết quả cuối.

**Tự động lưu:** giữ ván đang chơi theo từng tab. Đóng tab có thể mất khóa tiếp tục ván đó.

**Lưu ván / Tải ván:** giữ một bản riêng trong IndexedDB, dùng chung giữa các tab của cùng trình duyệt và địa chỉ web. Lưu lần sau thay bản trước. Tải ván đọc và kiểm tra bản lưu, hiện bản xem trước và chỉ thay bàn sau khi xác nhận. Có thể mở tab mới rồi bấm Tải ván để tiếp tục bản đã lưu thủ công.

**Xuất JSON / Nhập JSON:** xuất tệp `CoDongSon-....json` về máy hoặc nhập tệp đã chọn. Định dạng có `format: "dongson-game"`, `version: 1` và toàn bộ dữ liệu ván/lịch sử. Không gửi dữ liệu tới máy chủ. Tệp nhập tối đa 16 MB; kiểm tra phiên bản, bàn cờ, quân/Thần, cờ trạng thái, chuỗi thế, chuyển tiếp lịch sử và đồng hồ trước khi hỏi xác nhận. Tệp lỗi hoặc hủy xác nhận giữ nguyên ván hiện tại. Đây là kiểm tra tính nhất quán bản lưu, không phải xác thực lịch sử thi đấu chống gian lận.

Nạp ván tạo `gameId` mới để chặn lệnh từ đời ván cũ, giữ nguyên ID quân, lượt, phong cấp, Hoán Quân, lịch sử lặp và kết quả. Có thể tải/nhập cả khi bàn hiện tại đã kết thúc; đó là thay bằng một ván khác. Ván kết thúc được nạp vào vẫn bị khóa, chỉ được Chơi lại để bắt đầu ván mới.

Xóa dữ liệu trang sẽ xóa cả bản tự động và bản lưu thủ công. Dùng tệp JSON để giữ bản độc lập hoặc chuyển sang thiết bị/trình duyệt khác. Bản lưu JSON của FastAPI cũ không tự chuyển sang định dạng mới.

Nếu tab được nhân đôi và mang cùng khóa, giao dịch IndexedDB so sánh bản lưu trước khi ghi. Hai Worker không thể ghi đè nhau từ cùng một phiên bản cũ. Tab trở lại sẽ cập nhật trạng thái; yêu cầu cũ bị trả về lỗi kèm thế mới.

Chỉ xác nhận lệnh thành công sau khi lưu xong. Worker bị lỗi/hết thời gian sẽ bị đóng; lần gọi tiếp theo tạo Worker mới và khôi phục bản đã ghi. Nếu lệnh đã lưu nhưng chưa kịp phản hồi, revision sẽ chặn việc ghi lại thao tác đó. Lỗi lưu ván hoàn tác thay đổi chưa ghi. Đây không phải xác thực chống gian lận cho thi đấu từ xa.

## Kiểm thử

```text
npm test
npm run test:bridge
npm run test:files
npm run build
npm run test:web:browser
```

`test:web:browser` chạy bản dist trên máy chủ **chỉ phục vụ tệp tĩnh**, tại đường dẫn con. Các yêu cầu tới FastAPI và tên miền ngoài đều bị chặn. Bộ thử kiểm tra ván thường đến Tiến Cung khi offline, phong cấp hai màu, hòa/kết thúc/chơi lại, lưu và tải lại, các thế đặc biệt, và nhịp giao diện khi Worker thực hiện tính luật liên tiếp.

Tạo thế thử sử dụng Python 3.12 cùng requirements-dev của dự án; đây là công cụ kiểm thử, không phải phụ thuộc khi phát hành hoặc chơi web. `npm run test:api` và `npm run test:browser` vẫn dành cho đối chiếu bộ API cũ. Chỉ đặt `VITE_ENGINE=api` khi chủ động dùng chế độ đó; mặc định luôn là Worker.

Luật và các cách diễn giải đã chốt vẫn nằm trong [RULES.md](../RULES.md).

Kết quả và giới hạn kiểm thử cầu nối: [WORKER_TEST_REPORT.md](WORKER_TEST_REPORT.md).

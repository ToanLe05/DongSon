# Cờ Đông Sơn — hai người trên cùng thiết bị

Bản web mặc định chạy bộ luật Python **ngay trong trình duyệt bằng Pyodide/Web Worker**. Hai người luân phiên trên cùng bàn cờ, có chọn phong cấp, Hoán Quân, hòa, đầu hàng, lý do kết thúc và chơi lại. Không cần FastAPI hoặc cài Python để chơi.

## Chạy từ mã nguồn

Cài Node.js 24 và npm 11. Tại thư mục dự án:

```text
npm ci
npm run build
npm start
```

Mở http://localhost:8000. Cổng khác: `npm start -- --port 8080`. Phát triển: `npm run dev`, rồi mở địa chỉ Vite thông báo; không cần mở API.

Người chơi truy cập website đã triển khai chỉ cần trình duyệt. Tải lại cùng tab giữ ván bằng IndexedDB; xóa dữ liệu trang sẽ xóa bản lưu. Sau khi tải xong có thể tiếp tục chơi khi mất mạng; chưa có PWA bảo đảm tải lại trang offline.

**Lưu ván / Tải ván** giữ một bản riêng trong trình duyệt, mở lại được từ tab mới. **Xuất JSON / Nhập JSON** tải tệp về máy hoặc chuyển ván giữa thiết bị. Bản nhập được kiểm tra và xác nhận trước khi thay bàn; hủy hoặc tệp lỗi giữ nguyên ván hiện tại. Xem [hướng dẫn lưu/tải](docs/WEB.md#lưu-và-khôi-phục-ván).

## Đưa lên hosting tĩnh

[Từng bước đưa mã nguồn lên GitHub bằng GitHub Desktop](docs/UPLOAD_GITHUB.md). Tạo gói mã nguồn sạch trên Windows: `npm run package:source`; kết quả nằm trong `release/`, không chứa thư viện đã cài, bộ nhớ đệm hoặc `.exe`.

**GitHub Pages:** chạy `npm run build:pages -- --repository OWNER/REPO`, rồi triển khai nội dung `dist-pages/`. Đã có workflow chạy thủ công và [hướng dẫn đường dẫn Pages](docs/GITHUB_PAGES.md).

Đưa toàn bộ nội dung `dist/` lên web, gồm `assets/` và `python-runtime/`. Có thể đặt ở đường dẫn con. Không mở index.html bằng file://.

[Hướng dẫn kiến trúc, lưu ván, chạy và triển khai](docs/WEB.md) · [Luật áp dụng và các thế đúng/sai](RULES.md).

[Kiểm tra cầu nối Python/Web Worker](docs/WORKER_TEST_REPORT.md).

[Kiểm tra lưu/tải và JSON](docs/GAME_FILES_TEST_REPORT.md).

Dockerfile cũng phục vụ bản tĩnh, không cài Python. Container chưa được build trên máy kiểm thử vì Docker Engine chưa chạy.

## Phiên bản đã khóa

| Thành phần | Phiên bản |
| --- | --- |
| Node.js tham chiếu | 24.18.0 |
| npm tham chiếu | 11.16.0 |
| Pyodide | 0.29.5 |
| Python trong trình duyệt | 3.13.2 |
| Pixi.js | 8.14.0 |
| Vite | 6.4.5 |
| Playwright Test | 1.56.1 |

package.json khóa thư viện trực tiếp, package-lock.json khóa toàn bộ phụ thuộc. Chỉ cần `npm ci` để dựng bản web; Python runtime được lấy từ gói Pyodide đã khóa và chép vào dist khi build. Dung lượng bộ chạy khoảng 12,3 MB chưa nén.

## Kiểm thử

`npm test` và `npm run build` chỉ cần Node. `test:web:browser` cần thêm môi trường Python trong phần dưới để tạo thế thử trước khi chạy; Python không tham gia phục vụ website.

```text
npm test
npm run build
npm run test:browser:install
npm run test:web:browser
```

JavaScript kiểm tra hoạt ảnh, sự kiện, phong cấp, đồng bộ và vòng đời Worker. Kiểm thử web chạy trên hosting tĩnh tại đường dẫn con, chặn API/CDN, dùng Python/WebAssembly thật.

Để tạo các thế thử và đối chiếu CPython/API cũ, tạo môi trường Python 3.12:

```text
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r src/requirements-dev.txt
npm run test:bridge
npm run test:api
npm run test:web:browser
```

Trên Linux/macOS, dùng `.venv/bin/python` thay đường dẫn Scripts/python.exe. src/requirements.txt, requirements-dev.txt và constraints.txt vẫn khóa các phụ thuộc của công cụ Python/API cũ. Chúng không được cài trong bản web tĩnh.

## API và bản Windows trước đây

Giữ lại FastAPI để đối chiếu: `npm run dev:api` hoặc `npm run start:api`. Giao diện chỉ dùng API khi build/dev với `VITE_ENGINE=api`, có thể đặt thêm `VITE_API_URL`; bỏ biến chế độ này để trở về Worker. `npm run test:browser` vẫn là bộ kiểm thử API cũ; bộ mặc định cho web tĩnh là `test:web:browser`.

Bản [CoDongSon.exe](CoDongSon.exe) đã tạo trước đây vẫn dùng kiến trúc desktop/API của đợt trước; chưa được tạo lại theo cầu nối Worker này. [Hướng dẫn Windows](docs/DESKTOP.md).

[Báo cáo đợt FastAPI trước](docs/WEB_TEST_REPORT.md) được giữ làm lịch sử, không đại diện cho kiến trúc phát hành hiện tại.

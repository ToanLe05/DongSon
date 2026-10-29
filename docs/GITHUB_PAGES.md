# Đưa Cờ Đông Sơn lên GitHub Pages

Bản Pages là website tĩnh cho hai người chơi trên cùng thiết bị. Bộ luật Python chạy trong Web Worker, không cần FastAPI.

## Dựng bản Pages

Cài Node.js 24 và npm 11, rồi chạy tại thư mục dự án:

```text
npm ci
npm run build:pages -- --repository OWNER/REPO
```

Thay `OWNER/REPO` bằng tài khoản và tên repo thực tế, giữ đúng chữ hoa/thường. Ví dụ `ToanLVK/DongSon` tạo base `/DongSon/`. Repo `OWNER/OWNER.github.io` tự dùng `/`. Quy tắc này theo [hướng dẫn triển khai của Vite](https://vite.dev/guide/static-deploy).

Kết quả nằm trong **`dist-pages/`**, gồm `index.html`, `.nojekyll`, `assets/` và `python-runtime/`. Lệnh này luôn chọn bộ luật cục bộ, kể cả khi môi trường đang cấu hình API cũ. Bản `dist/` đang dùng để chạy tại máy được giữ riêng.

Có thể chỉ định đường dẫn trực tiếp:

```text
npm run build:pages -- --base /DongSon/
npm run build:pages -- --base /
```

Dùng `/` cho website ở gốc tên miền hoặc tên miền riêng. `--base` ưu tiên hơn biến môi trường `PAGES_BASE_PATH`; nếu không chỉ định base thì tên repo lấy từ `--repository` hoặc `GITHUB_REPOSITORY`. Không truyền cả URL tên miền vào base. `npm run build` thông thường vẫn dùng base tương đối `./` và xuất vào `dist/`.

## Xem thử đúng đường dẫn con

Sau khi dựng với base `/DongSon/`:

```text
node scripts/serve-static.cjs --root dist-pages --port 8081 --base /DongSon/
```

Mở http://localhost:8081/DongSon/. Nếu dùng base khác, thay cả đường dẫn phục vụ và địa chỉ mở. Không mở `index.html` bằng `file://`.

## Triển khai bằng GitHub Actions

Đã có workflow **Publish GitHub Pages** trong `.github/workflows/pages.yml`. Workflow chỉ chạy thủ công; chưa có thao tác xuất bản nào được thực hiện từ máy này.

1. Đưa mã nguồn và `package-lock.json` lên repo, gồm cả `.github/`, `scripts/` và `src/`.
2. Trong repo, vào **Settings → Pages → Source**, chọn **GitHub Actions**.
3. Vào **Actions → Publish GitHub Pages → Run workflow** trên nhánh chứa mã nguồn.
4. Khi hoàn tất, mở địa chỉ được bước triển khai trả về.

Workflow lấy tên repo thực tế từ GitHub, cài đúng thư viện, chạy kiểm thử JavaScript, dựng `dist-pages/` rồi tải toàn bộ thư mục này lên Pages. Nếu dùng tên miền riêng, tạo biến repo **PAGES_BASE_PATH** với giá trị `/` trước khi chạy workflow. Đổi đường dẫn hoặc tên repo thì dựng và triển khai lại. Workflow chưa được chạy trên GitHub trong đợt kiểm tra này.

Nếu tải thủ công lên hosting khác, tải **toàn bộ nội dung** `dist-pages/`. Máy chủ phải phục vụ JavaScript với MIME JavaScript và `.wasm` với `application/wasm`.

## Đường dẫn ảnh, phông chữ và Python

- Ảnh, hình quân và favicon đi qua cơ chế tài nguyên của Vite; bản build đặt chúng vào `assets/` và tự thêm base. Không ghép thêm `/assets/` cố định hoặc thêm base lần thứ hai.
- Worker được Vite đóng gói; địa chỉ bộ chạy Python lấy từ `import.meta.env.BASE_URL`, hoạt động cả khi mở URL kết thúc bằng `index.html`.
- Năm tệp bộ chạy Python được chép từ gói Pyodide đã khóa vào `python-runtime/`. Chế độ phát triển cũng phục vụ chúng dưới cùng base, với MIME phù hợp.
- `dongson_engine.py`, `serializers.py`, `bot_agent.py` và `browser_bridge.py` được nhập bằng `?raw` và đóng gói trong Worker. Không có yêu cầu HTTP tải riêng tệp `.py`. Đường dẫn `/home/pyodide/dongson` là hệ thống tệp bên trong Python, không phải đường dẫn website.
- Giao diện dùng phông hệ thống `Segoe UI`, `Arial`, `sans-serif`; chữ trên bàn dùng `Georgia`, `Times New Roman`, `serif`. Không cần tải phông từ CDN. Hình dáng chữ có thể khác nhẹ giữa các hệ điều hành.

Tham khảo [tài nguyên tĩnh của Vite](https://vite.dev/guide/assets) và [base khi dựng bản web](https://vite.dev/guide/build#public-base-path).

## Kiểm tra lại

```text
npm test
npm run build
npm run build:pages -- --base /DongSon/
npm run test:browser:install
npm run test:pages
```

Bộ kiểm tra Pages dùng các cổng 4184–4186: kiểm tra ảnh, favicon, Worker và năm tệp Python dưới `/DongSon/`; MIME và phân biệt chữ hoa/thường; bắt đầu, đi quân, đầu hàng và chơi lại; chế độ phát triển có base; bản tương đối chạy ở gốc website. Các yêu cầu ra ngoài website hoặc đến API làm bài kiểm tra thất bại. Kiểm tra này không thay thế bộ kiểm tra toàn bộ luật cờ.

Kết quả tại máy ngày 29/10/2026: **34/34** kiểm thử JavaScript và **4/4** kiểm thử Pages đạt; cả bản `dist/` và `dist-pages/` dựng thành công. Báo cáo giao diện nằm tại `.test-artifacts/pages-ui-results.json`, ảnh chụp tại `.test-artifacts/ui-screenshots/github-pages-index.png`. Chưa kiểm tra một lần triển khai trực tiếp trên GitHub Pages.

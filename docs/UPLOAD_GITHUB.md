# Đưa mã nguồn Cờ Đông Sơn lên GitHub

Cách bên dưới dùng **GitHub Desktop**, thao tác bằng chuột. Chỉ cần giải nén gói mã nguồn; không cần cài thư viện hoặc mở PowerShell để tải mã lên GitHub.

## 1. Chuẩn bị gói mã nguồn

Mở thư mục `release/`, lấy tệp **`DongSon-source-<ngày-giờ>.zip`** mới nhất, bấm chuột phải → **Extract All / Giải nén tất cả**. Bên trong có thư mục `DongSon/` chứa `package.json`, `package-lock.json`, `src/`, `scripts/`, `tests/`, `docs/` và `.github/`.

Đây là gói **mã nguồn**, không phải bộ cài trò chơi. Không đưa nguyên tệp ZIP lên repo: cần đưa các tệp đã giải nén lên để GitHub nhận được cấu hình và workflow.

Gói giữ ảnh trò chơi, mã Python, cấu hình Vite, phiên bản Node/npm, các requirements/constraints Python, kiểm thử và hướng dẫn. Không có `node_modules`, môi trường Python, bộ nhớ đệm, bản build, bản lưu ván, lịch sử Git, bộ cài DeskIn hoặc tệp `.exe`. Phông NotoSansCJKtc không được sử dụng cũng không được đóng gói. Các tệp gốc trên máy vẫn được giữ nguyên.

Tệp `.manifest.json` nằm cạnh ZIP liệt kê từng tệp và mã SHA-256 để kiểm tra gói; không cần đưa tệp manifest lên repo.

## 2. Cài và đăng nhập GitHub Desktop

1. Tạo/đăng nhập tài khoản tại https://github.com.
2. Tải **GitHub Desktop** từ https://desktop.github.com, cài rồi mở.
3. Chọn **Sign in to GitHub.com** và hoàn tất đăng nhập trong trình duyệt.

GitHub Desktop hỗ trợ tạo repo, commit và đưa mã lên GitHub bằng giao diện. Tham khảo [hướng dẫn chính thức](https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop).

## 3. Tạo repo trên máy và chép mã vào

1. Trong GitHub Desktop, chọn **File → New repository** (hoặc **Create a New Repository on your Hard Drive**).
2. Điền **Name:** `DongSon`.
3. Chọn **Local path** là một thư mục cha mới, ví dụ `Documents/GitHub`. Ứng dụng sẽ tạo repo tại `Documents/GitHub/DongSon`. Không chọn đè thư mục dự án đang làm việc trong Downloads.
4. Để **Git ignore** và **License** là **None**; bỏ chọn tạo README vì gói đã có README và `.gitignore`. Bấm **Create repository**.
5. Chọn **Repository → Show in Explorer** để mở thư mục repo vừa tạo.
6. Mở thư mục `DongSon` đã giải nén ở bước 1. Chọn **toàn bộ nội dung bên trong**, rồi chép vào thư mục repo vừa mở. Không chép thêm một lớp thư mục `DongSon` bao ngoài.
7. Bật **View → Show → Hidden items** trong File Explorer nếu cần để kiểm tra `.github`, `.gitignore`, `.npmrc`, `.nvmrc` đã được chép. Giữ nguyên thư mục `.git` do GitHub Desktop tạo.
8. Trở lại GitHub Desktop. Trong **Changes**, kiểm tra có `src/`, `package.json`, `package-lock.json` và `.github/workflows/pages.yml`; không có `node_modules`, bộ cài hoặc `.exe`.
9. Nhập **Summary:** `Add Dong Son game source`, rồi bấm **Commit to main** (nút có thể hiện tên nhánh hiện tại khác `main`).

Ở thư mục gốc repo, phải nhìn thấy `package.json` ngay bên cạnh `src/`. Nếu thấy `DongSon/DongSon/package.json`, mã đang bị lồng thêm một thư mục; chuyển nội dung thư mục trong ra gốc trước khi commit.

## 4. Đưa repo lên GitHub

1. Bấm **Publish repository** ở thanh trên.
2. Giữ tên `DongSon`, có thể điền mô tả `Co Dong Son - local two-player browser game`.
3. Để mã nguồn công khai, bỏ chọn **Keep this code private**. [GitHub Pages trên tài khoản miễn phí dùng repo công khai](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
4. Bấm **Publish repository**.
5. Chọn **Repository → View on GitHub**. Kiểm tra trên web có `src/`, `.github/`, `package-lock.json` và README.

Các lựa chọn xuất bản và quyền riêng tư được mô tả trong [tài liệu GitHub Desktop](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop). Nếu tên repo đã tồn tại trên tài khoản, chọn một tên repo mới; không ghi đè repo cũ. Cấu hình Pages tự nhận tên repo mới.

## 5. Bật website để chơi

1. Trên trang repo GitHub, vào **Settings → Pages**.
2. Trong **Build and deployment → Source**, chọn **GitHub Actions**. Không chọn `Deploy from a branch`.
3. Vào tab **Actions** → chọn **Publish GitHub Pages**.
4. Bấm **Run workflow**, chọn nhánh đã đưa mã lên, rồi bấm **Run workflow** để bắt đầu.
5. Đợi lần chạy hoàn tất với dấu tích xanh. Mở lần chạy; bước **Publish** hoặc phần **Deployments / github-pages** có địa chỉ website.
6. Với repo `DongSon`, địa chỉ thông thường là `https://TEN_TAI_KHOAN.github.io/DongSon/`. Dùng đúng chữ hoa/thường của tên repo.
7. Mở website, bấm **Bắt đầu**, thử đi một quân, đầu hàng và **Chơi lại**.

Theo [tài liệu cấu hình Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), workflow tùy chỉnh là nguồn triển khai phù hợp ở đây. Workflow đã có sẵn sẽ cài thư viện từ `package-lock.json`, kiểm thử JavaScript, dựng bản web và tải toàn bộ `dist-pages/` lên Pages. Người chơi chỉ cần mở liên kết, không cài Node/Python.

Nếu không thấy workflow, kiểm tra đã chép `.github/workflows/pages.yml` vào đúng gốc repo và đã đẩy lên nhánh đang xem. Nếu lần chạy thất bại, mở bước có dấu đỏ để xem lỗi; nếu trang trắng/404, đối chiếu [hướng dẫn Pages](GITHUB_PAGES.md). Với tên miền riêng, xem phần `PAGES_BASE_PATH` trong tài liệu đó.

## 6. Cập nhật lần sau

Sửa/chép tệp trong **thư mục repo GitHub Desktop đang quản lý** → mở **Changes** → nhập mô tả → **Commit** → **Push origin**. Sau đó vào **Actions → Publish GitHub Pages → Run workflow** để cập nhật website. Workflow hiện chỉ chạy thủ công.

## Dành cho người muốn dựng lại từ mã nguồn

Node.js tham chiếu **24.18.0**, npm **11.16.0**. Sau khi tải/clone repo, chạy:

```text
npm ci
npm test
npm run build
npm start
```

Mở http://localhost:8000. `npm ci` lấy lại thư viện đã khóa, nên không cần đưa `node_modules` lên GitHub. Python chạy trong trình duyệt đã thuộc gói Pyodide; Python cài riêng chỉ cần cho các công cụ kiểm thử/bản desktop cũ, theo README.

Đóng gói lại trên Windows bằng `npm run package:source`. Lệnh tạo ZIP và manifest mới trong `release/`, không xóa các tệp gốc hoặc xuất bản lên GitHub.

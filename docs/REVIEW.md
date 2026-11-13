# GDD v1.2 Review

## Verdict
Khả thi cho web, phạm vi đã được thu gọn hợp lý (4 zone, 30 robot, cut list, vertical slice). Rủi ro chính: asset (súng, robot, âm thanh) và độ "realistic" khi phần lớn là procedural. Nên bắt đầu ngay, giữ vertical slice làm cổng kiểm tra.

## Điểm mạnh
- Pillars rõ, có cut list + danh sách "không cắt".
- Ngân sách đạn có tính toán (≈404 phát trúng, ≈800 viên ở 50% chính xác).
- Charger có telegraph/khóa hướng/choáng → counterplay rõ, hợp với grapple.
- Kiến trúc hiệu năng đúng hướng: InstancedMesh cho container, AI tick tách khỏi render, pooling.

## Vấn đề & đề xuất (mặc định để team chạy, có thể đổi)
| # | Vấn đề | Đề xuất |
|---|---|---|
| 1 | Chuột phải nạp đạn, không nhảy | Input map có thể rebind. Mặc định theo GDD; thêm R làm alias nạp đạn. Không nhảy ở v1 (grapple thay thế). |
| 2 | Điểm yếu Boss cao 22 m, grapple chỉ kéo tới điểm neo rồi nhả | Khu Boss cần "perch" (bệ đứng) trên crane/tháp ở 8/14/20 m. Không làm treo/đu dây ở v1. |
| 3 | Asset GameBanana (CS 1.6 MDR) | Giấy phép gần như chắc chắn không rõ. Mạng sandbox chặn gamebanana.com. Dùng view model procedural ngay từ đầu; pipeline MDL→GLB là track tùy chọn, chỉ chạy khi người dùng tải archive lên. (Đã thay thế: chủ dự án cung cấp `v_g36c.mdl`, xem `docs/ASSETS.md` và T-18.) |
| 4 | "Baked lighting" khó với scene procedural | Dùng `shadowMap.autoUpdate=false` + render shadow một lần cho tĩnh; shadow động chỉ trong frustum nhỏ quanh người chơi. |
| 5 | Va chạm/character controller | Thế giới chủ yếu là hộp → dùng Rapier KCC (capsule) ngay từ M1; tránh tự viết collision. |
| 6 | Đợt địch khi bảo vệ trụ mâu thuẫn tổng 30 | Đợt bảo vệ lấy robot hiện có trong zone (kéo về trụ), không spawn thêm. |
| 7 | Chết: chưa chốt | Checkpoint tại mỗi trụ đã kích hoạt + đầu trận Boss; countdown không reset. |
| 8 | Gợi ý hướng đi | Marker la bàn trên HUD tới trụ gần nhất chưa kích hoạt. |
| 9 | Âm thanh không có asset | Tổng hợp bằng Web Audio (procedural) ở v1. |
| 10 | Thiếu kiểm thử tự động | Vitest cho logic thuần (damage, ammo, FSM, countdown); Playwright smoke (load, không lỗi console, FPS). |
| 11 | Ngân sách đạn sát (≈870 cung vs ≈800 cần) | Giữ; drop 15% làm đệm. Tunables trong một file config để playtest. |
| 12 | Boss khi countdown dừng → mất áp lực | Chấp nhận; áp lực đến từ đòn Boss. |

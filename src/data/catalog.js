export const groups = [
  { id: 'all', name: 'Tất cả giải pháp', short: 'Tất cả', icon: 'grid' },
  { id: 'cnapp', name: 'CNAPP, Zero Trust & AI Security', short: 'CNAPP & Zero Trust', icon: 'lock' },
  { id: 'soc', name: 'Trung tâm điều hành an ninh mạng', short: 'SOC & vận hành', icon: 'activity' },
  { id: 'labs', name: 'Cyber Labs · Nghiên cứu & giảng dạy', short: 'Cyber Labs', icon: 'flask' },
  { id: 'devsecops', name: 'DevSecOps', short: 'DevSecOps', icon: 'code' },
  { id: 'config', name: 'Tối ưu cấu hình & truy cập an toàn', short: 'Cấu hình & truy cập', icon: 'fingerprint' },
  { id: 'quality', name: 'Đánh giá, kiểm thử & hiệu năng phần mềm', short: 'Kiểm thử phần mềm', icon: 'gauge' },
  { id: 'osint', name: 'Thu thập & phân tích thông tin không gian mạng', short: 'Thông tin không gian mạng', icon: 'search' },
  { id: 'data', name: 'Bảo vệ dữ liệu & danh tính', short: 'Dữ liệu & danh tính', icon: 'shield' },
  { id: 'risk', name: 'Quản lý rủi ro & hiện diện số', short: 'Rủi ro & hiện diện số', icon: 'radar' },
];

// folderName maps each visible solution to its exact folder under Solutions/.
export const solutions = [
  { id: '02-picus', folderName: '02. Picus', name: 'Picus Security', group: 'soc', mark: 'PICUS', tone: 'blue', desc: 'Tài liệu tổng quan, PoC, triển khai, battlecard và tài liệu kỹ thuật.', tags: ['BAS', 'CTEM'] },
  { id: '03-niagara', folderName: '03. Niagara', name: 'Niagara Networks', group: 'soc', mark: 'NIAGARA', tone: 'cyan', desc: 'Tài liệu giải pháp và triển khai về khả năng quan sát lưu lượng mạng.', tags: ['Network visibility', 'NDR'] },
  { id: '04-apposite', folderName: '04. Apposite', name: 'Apposite Technologies', group: 'quality', mark: 'APPOSITE', tone: 'blue', desc: 'Tài liệu mô phỏng mạng, kiểm thử và đánh giá hiệu năng.', tags: ['Network emulation', 'Performance'] },
  { id: '05-crimewall-maltego', folderName: '05. Crimwall & Maltego', name: 'Crimewall & Maltego', group: 'osint', mark: 'MALTEGO', tone: 'purple', desc: 'Tài liệu phân tích mối liên hệ và thu thập thông tin không gian mạng.', tags: ['OSINT', 'Investigation'] },
  { id: '06-sechard', folderName: '06. SecHard', name: 'SecHard', group: 'config', mark: 'SECHARD', tone: 'green', desc: 'Tài liệu hardening và tối ưu cấu hình bảo mật hệ thống.', tags: ['Hardening', 'Configuration'] },
  { id: '07-graylog', folderName: '07. Graylog', name: 'Graylog', group: 'soc', mark: 'graylog', tone: 'cyan', desc: 'Tài liệu tổng quan, demo và cài đặt Graylog.', tags: ['SIEM', 'Log management'] },
  { id: '08-keysight', folderName: '08. Keysight', name: 'Keysight', group: 'labs', mark: 'KEYSIGHT', tone: 'red', desc: 'Tài liệu giải pháp, PoC, triển khai và kiểm thử mạng.', tags: ['Network testing', 'Cyber range'] },
  { id: '09-exxact', folderName: '09. Exxact AI', name: 'Exxact AI', group: 'labs', mark: 'EXXACT', tone: 'blue', desc: 'Tài liệu hạ tầng tính toán hiệu năng cao và AI.', tags: ['HPC', 'AI'] },
  { id: '10-accuknox', folderName: '10. AccuKnox', name: 'AccuKnox', group: 'cnapp', mark: 'ACCUKNOX', tone: 'blue', desc: 'Tài liệu về CNAPP, bảo vệ cloud-native và runtime security.', tags: ['CNAPP', 'Cloud security'] },
  { id: '11-penlink', folderName: '11. Penlink - Webint', name: 'Penlink · Webint', group: 'osint', mark: 'PENLINK', tone: 'cyan', desc: 'Tài liệu giải pháp Web Intelligence và hỗ trợ điều tra số.', tags: ['Webint', 'OSINT'] },
  { id: '12-parasoft', folderName: '12. Parasoft', name: 'Parasoft', group: 'devsecops', mark: 'PARASOFT', tone: 'blue', desc: 'Tài liệu kiểm thử phần mềm, phân tích mã và tích hợp quy trình phát triển.', tags: ['SAST', 'Testing'] },
  { id: '13-cimcor', folderName: '13. Cimcor', name: 'Cimcor', group: 'config', mark: 'CIMCOR', tone: 'blue', desc: 'Tài liệu giám sát tính toàn vẹn và thay đổi trên hệ thống.', tags: ['Integrity monitoring', 'FIM'] },
  { id: '14-iriusrisk', folderName: '14. Irius Risk TM', name: 'IriusRisk', group: 'devsecops', mark: 'IRIUSRISK', tone: 'pale', desc: 'Tài liệu threat modeling và thiết kế bảo mật từ sớm.', tags: ['Threat modeling', 'AppSec'] },
  { id: '15-cyber-test', folderName: '15. Cyber Test System', name: 'Cyber Test System', group: 'labs', mark: 'CYBER TEST', tone: 'green', desc: 'Tài liệu nền tảng và hệ thống kiểm thử an ninh mạng.', tags: ['Cyber test', 'Lab'] },
  { id: '20-security-scorecard', folderName: '20. Security Scorecard', name: 'SecurityScorecard', group: 'risk', mark: 'SCORECARD', tone: 'green', desc: 'Tài liệu đánh giá mức độ an ninh và rủi ro từ bên ngoài.', tags: ['Security ratings', 'Risk'] },
  { id: '21-nowsecure', folderName: '21. NowSecure', name: 'NowSecure', group: 'quality', mark: 'NOWSECURE', tone: 'blue', desc: 'Tài liệu kiểm thử bảo mật ứng dụng di động.', tags: ['Mobile security', 'AppSec'] },
  { id: '22-blancco', folderName: '22. Blannco', name: 'Blancco', group: 'data', mark: 'BLANCCO', tone: 'cyan', desc: 'Tài liệu xóa dữ liệu an toàn, kiểm thử và yêu cầu kỹ thuật.', tags: ['Data erasure', 'Sanitization'] },
  { id: '23-eggplant', folderName: '23. Eggplant', name: 'Eggplant', group: 'quality', mark: 'EGGPLANT', tone: 'green', desc: 'Tài liệu tự động hóa kiểm thử và đánh giá trải nghiệm phần mềm.', tags: ['Test automation', 'Quality'] },
  { id: '24-trend-micro', folderName: '24. Trend Micro', name: 'Trend Micro', group: 'soc', mark: 'TREND MICRO', tone: 'red', desc: 'Tài liệu giới thiệu, demo và bảo vệ máy chủ, endpoint, cloud.', tags: ['Endpoint', 'XDR'] },
  { id: '25-didomi', folderName: '25. Didomi', name: 'Didomi', group: 'data', mark: 'DIDOMI', tone: 'purple', desc: 'Tài liệu về quyền riêng tư, consent và quản lý lựa chọn dữ liệu.', tags: ['Privacy', 'Consent'] },
  { id: '27-forcepoint', folderName: '27. Forcepoint', name: 'Forcepoint', group: 'data', mark: 'FORCEPOINT', tone: 'blue', desc: 'Tài liệu danh mục sản phẩm và giải pháp bảo vệ dữ liệu.', tags: ['DLP', 'Data security'] },
  { id: '28-forestall', folderName: '28. Forestall', name: 'Forestall', group: 'data', mark: 'FORESTALL', tone: 'red', desc: 'Tài liệu giới thiệu và tiếp thị giải pháp Forestall.', tags: ['Data security', 'DLP'] },
  { id: '29-simspace', folderName: '29. SimpSpace', name: 'SimSpace', group: 'labs', mark: 'SIMSPACE', tone: 'purple', desc: 'Tài liệu cyber range phục vụ diễn tập và đào tạo an ninh mạng.', tags: ['Cyber range', 'Training'] },
  { id: '666-fasoo', folderName: '666. Fasoo', name: 'Fasoo', group: 'data', mark: 'FASOO', tone: 'orange', desc: 'Tài liệu bảo vệ dữ liệu và tài liệu số trong doanh nghiệp.', tags: ['Data protection', 'Document security'] },
  { id: '96-seclab-tyrex', folderName: '96. Seclab, Tyrex', name: 'Seclab · Tyrex', group: 'config', mark: 'SECLAB', tone: 'cyan', desc: 'Tài liệu giải pháp mạng công nghiệp và các sản phẩm liên quan.', tags: ['OT security', 'Network'] },
];

// Shared references; member-specific and customer-specific folders stay out of the common index.
export const collections = [
  { id: 'overview', folderName: '0. Hệ thống tổng thể', name: 'Kiến trúc & giải pháp tổng thể', desc: 'Tài liệu giới thiệu năng lực và sơ đồ tổng quan.' },
  { id: 'maturity', folderName: '0. Giai phap theo cap do', name: 'Giải pháp theo cấp độ', desc: 'Tài liệu tham khảo, danh mục và phương án theo cấp độ.' },
  { id: 'cyberrange-keysight', folderName: 'CyberRange_Keysight', name: 'Cyber Range · Keysight', desc: 'Tài liệu phục vụ môi trường cyber range của Keysight.' },
  { id: 'sale-kits', folderName: '97. Sale Kits', name: 'Sales kits', desc: 'Tài liệu dùng chung để chuẩn bị nội dung bán hàng.' },
  { id: 'partner-presentations', folderName: '98. Present with Partners', name: 'Trình bày cùng đối tác', desc: 'Bài trình bày và tài liệu dùng chung với đối tác.' },
  { id: 'internal-presentations', folderName: '99. Present nội bộ', name: 'Trình bày nội bộ', desc: 'Bài trình bày và tài liệu tham khảo nội bộ.' },
  { id: 'root-files', folderName: '', name: 'Tài liệu tham khảo chung', desc: 'Tài liệu đặt trực tiếp trong thư mục Solutions.' },
];


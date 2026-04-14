package iuh.fit.ConnectionAppBackend.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {

    // Map: email -> OtpEntry (otp + expiry 1 phút)
    private final Map<String, OtpEntry> otpStore = new ConcurrentHashMap<>();

    // Map: email -> expiry (trạng thái "đã xác minh email", có hiệu lực 10 phút)
    private final Map<String, LocalDateTime> verifiedStore = new ConcurrentHashMap<>();

    private static final int OTP_EXPIRY_MINUTES = 1;
    private static final int VERIFIED_EXPIRY_MINUTES = 10;

    /**
     * Tạo OTP mới cho email, xóa trạng thái verified cũ nếu có.
     */
    public String generateOtp(String email) {
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpStore.put(email, new OtpEntry(otp, LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES)));
        verifiedStore.remove(email); // reset trạng thái verified khi gửi OTP mới
        return otp;
    }

    /**
     * Xác minh OTP. Trả về true nếu đúng và còn hạn.
     * Không xóa OTP khỏi otpStore để các luồng dùng lại (invalidateOtp gọi sau khi hoàn tất).
     */
    public boolean verifyOtp(String email, String otp) {
        OtpEntry entry = otpStore.get(email);
        if (entry == null) return false;
        if (LocalDateTime.now().isAfter(entry.expiry())) {
            otpStore.remove(email);
            return false;
        }
        return entry.otp().equals(otp);
    }

    /**
     * Đánh dấu email là đã xác minh (sau khi verify-otp thành công).
     * Trạng thái này có hiệu lực 10 phút — đủ để người dùng điền thông tin tài khoản.
     * OTP vẫn giữ trong otpStore để không làm hỏng luồng khác (forgot-password).
     */
    public void markEmailVerified(String email) {
        verifiedStore.put(email, LocalDateTime.now().plusMinutes(VERIFIED_EXPIRY_MINUTES));
        // Không xóa otpStore — OTP tự hết hạn sau 1 phút mà không ảnh hưởng luồng khác
    }

    /**
     * Kiểm tra xem email có đang ở trạng thái "đã xác minh" không.
     */
    public boolean isEmailVerified(String email) {
        LocalDateTime expiry = verifiedStore.get(email);
        if (expiry == null) return false;
        if (LocalDateTime.now().isAfter(expiry)) {
            verifiedStore.remove(email);
            return false;
        }
        return true;
    }

    /**
     * Hủy bỏ toàn bộ trạng thái OTP và verified của email (gọi sau khi đăng ký thành công).
     */
    public void invalidateOtp(String email) {
        otpStore.remove(email);
        verifiedStore.remove(email);
    }

    private record OtpEntry(String otp, LocalDateTime expiry) {}
}

package com.luneng.smartstore.merchantauth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffWechatBindingRepository extends JpaRepository<StaffWechatBinding, Long> {
    Optional<StaffWechatBinding> findByStaff_Id(long staffId);

    Optional<StaffWechatBinding> findByAppIdAndOpenid(String appId, String openid);

    Optional<StaffWechatBinding> findByAppIdAndOpenidAndEnabledTrue(String appId, String openid);
}

package com.luneng.smartstore.merchantauth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StaffWechatBindingRepository extends JpaRepository<StaffWechatBinding, Long> {
    Optional<StaffWechatBinding> findByStaff_Id(long staffId);

    Optional<StaffWechatBinding> findByAppIdAndOpenid(String appId, String openid);

    Optional<StaffWechatBinding> findByAppIdAndOpenidAndEnabledTrue(String appId, String openid);

    @Query("""
        select binding.staff.id
        from StaffWechatBinding binding
        where binding.appId = :appId and binding.openid = :openid and binding.enabled = true
        """)
    Optional<Long> findEnabledStaffId(
        @Param("appId") String appId,
        @Param("openid") String openid
    );
}

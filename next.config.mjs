/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // Bỏ qua 'fs' module khi chạy ở client-side
            config.resolve.fallback = {
                fs: false
            };
        }
        return config;
    }
};

export default nextConfig;
